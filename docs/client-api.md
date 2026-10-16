# Types DummyJSON et client API

Issue #1. Fichiers : `types/dummyjson.ts`, `utils/dummyjsonApi.ts`, `composables/useApi.ts`, `tests/unit/dummyjsonApi.spec.ts`.

## 1. Types écrits à partir des vraies réponses

Chaque type a été écrit en lisant la réponse réelle de l'API (`curl`), pas la documentation :

```bash
curl -s 'https://dummyjson.com/products?limit=1'
curl -s 'https://dummyjson.com/products/categories'
curl -s 'https://dummyjson.com/products/99999'   # {"message":"Product with id '99999' not found"}
```

Pour trouver les champs optionnels, les 194 produits ont été récupérés (`?limit=0`) et on a compté les clés présentes :

| Constat                                                    | Conséquence dans le type                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `brand` absent sur 92 produits sur 194 (épicerie, déco…)   | `brand?: string` : TypeScript oblige à gérer l'absence                                  |
| `availabilityStatus` ne prend que 3 valeurs                | Union `'In Stock' \| 'Low Stock' \| 'Out of Stock'` plutôt que `string`                 |
| `price` et `discountPercentage` sont des décimaux (9.99)   | Commentaire : convertir avec `toCents` avant tout calcul                                |
| `/products/categories` renvoie des objets, pas des chaînes | `Category { slug, name, url }` ; `/products/category-list` (chaînes seules) non utilisé |

Aucun `any` : les réponses sont typées par le générique de la requête (`request<ProductsResponse>(…)`).

## 2. Un seul fichier de types

Les types d'authentification de #10 (`types/auth.ts`) ont été fusionnés dans `types/dummyjson.ts` : toutes les réponses de l'API au même endroit. `MeResponse` a été renommé `User` (nom demandé par l'issue) ; les données sensibles de `/auth/me` restent volontairement non déclarées.

## 3. Deux clients, un pour chaque cas

| Client                | Pour                                            | Pourquoi                                                             |
| --------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| `useApi()` (nouveau)  | Catalogue, fiche produit, catégories            | Routes publiques : un visiteur non connecté doit pouvoir les appeler |
| `$authFetch` (de #12) | `/auth/me`, paniers, tout ce qui exige un jeton | Ajoute le jeton et le rafraîchit sur une 401                         |

**Alternative rejetée** : tout faire passer par `$authFetch`. Sans jeton, il considère la session expirée et lève `SessionExpiredError` : le catalogue serait inaccessible aux visiteurs. Envoyer un jeton inutile aux routes publiques exposerait aussi le jeton sans raison.

Les deux prennent l'URL de base dans `runtimeConfig.public.apiBase` : changer d'API ne touche qu'un fichier (`nuxt.config.ts`) ou une variable d'environnement (`NUXT_PUBLIC_API_BASE`).

## 4. Fabrique pure + composable (inversion des dépendances)

Même principe que `createAuthFetch` :

- `createDummyJsonApi(request)` dans `utils/` : construit les URL et les query params. Aucune dépendance à Nuxt, le transport est injecté ;
- `useApi()` dans `composables/` : branche `$fetch` et `apiBase`.

En test, on injecte un faux `request` qui enregistre les appels : pas de réseau, tests rapides et déterministes. Les pages ne connaissent que `useApi().getProducts(…)`, jamais une URL.

| Méthode                                             | Route DummyJSON                        |
| --------------------------------------------------- | -------------------------------------- |
| `getProducts(params)`                               | `GET /products`                        |
| `searchProducts(q, params)`                         | `GET /products/search?q=`              |
| `getProductsByCategory(slug, params)`               | `GET /products/category/{slug}`        |
| `getProduct(id)`                                    | `GET /products/{id}`                   |
| `getCategories()`                                   | `GET /products/categories`             |
| `getAllProductSummaries(scope, params)` (#5)        | `GET /products…?limit=0&select=…`      |
| `getProductsByIds(ids, { select?, signal? })` (#45) | `GET /products/{id}` × n, en parallèle |

`params` = `limit`, `skip`, `sortBy`, `order`, `signal`. Exemple, page 2 triée par prix décroissant : `getProducts({ limit: 12, skip: 12, sortBy: 'price', order: 'desc' })` → `/products?limit=12&skip=12&sortBy=price&order=desc`.

## 5. Plusieurs produits par identifiants (`getProductsByIds`, #45)

Le comparateur (3 produits au plus), les produits vus récemment et le panier ont besoin de **quelques produits précis**. DummyJSON n'a pas de route groupée (`/products?ids=1,2,3` n'existe pas), donc une seule méthode partagée :

```ts
const { products, missingIds, failedIds } = await useApi().getProductsByIds([16, 99999, 1], {
  select: ['title', 'price', 'thumbnail'], // optionnel : sinon produits complets
  signal, // optionnel : annule toutes les requêtes (ex. URL changée)
})
// products   → [produit 16, produit 1]  (ordre des identifiants)
// missingIds → [99999]                  (404 : à retirer de l'URL ou du cookie)
// failedIds  → []                       (réseau, 500 : à garder, « Réessayer »)
```

### Stratégie : un appel par produit, tous en parallèle

Mesures réelles (07/10/2026, produit 1, `curl`, taille compressée) :

| Requête                                                 | Poids (gzip) |
| ------------------------------------------------------- | ------------ |
| Produit complet, `GET /products/1`                      | **747 o**    |
| `select=title,price,thumbnail` (carte « vu récemment ») | **155 o**    |
| `select` des 10 champs d'une ligne du comparateur       | 262 o        |
| Tout le catalogue réduit (`getAllProductSummaries`, #5) | 6 800 o      |

| Stratégie                                                | Comparer 3 produits                                              | Retenue                   |
| -------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------- |
| **n appels en parallèle, avec `select`**                 | 3 appels simultanés, ≈ 0,8 Ko au total                           | ✅                        |
| n appels en série (`for … await`)                        | 3 allers-retours l'un après l'autre : ≈ 3 fois plus lent         | ❌                        |
| 1 appel pour tout le catalogue (`limit=0`), puis filtrer | 1 appel, mais 6,8 Ko pour en garder 3, et sans `stock`, `brand`… | ❌ pour quelques produits |

Le temps total est celui de la requête **la plus lente**, pas la somme : les appels partent en même temps (vérifié par un test : les 3 requêtes sont lancées avant que la première ne réponde). `select` divise le poids par 3 à 5. Au-delà de ~30 produits, un appel `limit=0` deviendrait plus léger que n appels : ce n'est le cas d'aucun usage actuel (3 produits comparés, quelques vus récemment, un panier).

### Choix et cas limites

- **`Promise.allSettled` et pas `Promise.all`** : avec `all`, un seul produit supprimé ferait échouer toute la page. Ici, les autres s'affichent toujours.
- **404 séparé des autres échecs** : un produit introuvable n'existe plus, on peut le retirer (URL, cookie) ; une erreur réseau ou 500 est peut-être passagère, on le garde et on propose de réessayer. Ce tri réutilise `sortCompareResults` (`utils/compare.ts`, #44) au lieu de le réécrire.
- **Ordre conservé** : les résultats sont rangés dans l'ordre des identifiants, quel que soit l'ordre d'arrivée des réponses.
- **Doublons** : `[5, 5, 6]` → 2 appels, chaque produit une seule fois.
- **Jamais d'exception** : tout en échec ou liste vide → listes vides, la page décide quoi afficher.
- **Typage de `select`** : sans `select`, des `Product` complets ; avec `select: ['title', 'price']`, TypeScript donne `Pick<Product, 'title' | 'price' | 'id'>`. Lire un champ non demandé est une erreur de compilation, pas un `undefined` en production. `id` est toujours inclus (l'API le renvoie toujours, vérifié). Un champ absent d'un produit (`brand` sur le produit 16) est simplement omis par l'API, et `brand` reste optionnel dans le type.
- **Annulation** : le `signal` est transmis à chaque appel. Sur `/comparer`, celui de `useAsyncData` coupe les requêtes si l'URL change pendant le chargement (comme la recherche de #3).

### Utilisations

- `/comparer` (#47) : branchée dans cette issue, à la place des appels `getProduct` en parallèle (comportement identique, les 11 parcours Playwright passent sans modification).
- Vus récemment (#50) : `getProductsByIds(ids, { select: ['title', 'price', 'thumbnail'] })`.
- Panier (`useCartProducts`, #9) : proposé à Marwan. Il fait aujourd'hui ses propres appels `$fetch` en parallèle avec `select` ; la méthode ferait la même chose, en distinguant en plus les produits supprimés (404) des erreurs réseau.

## 6. Cas limites

- **`order` sans `sortBy`** : ignoré par l'API, donc pas envoyé. `sortBy` seul envoie `order=asc`, pour une URL explicite.
- **Slug de catégorie venant de l'URL** : encodé (`encodeURIComponent`). `../auth/me` devient `..%2Fauth%2Fme` et ne peut pas viser une autre route.
- **Produit introuvable** (404) : l'erreur remonte telle quelle, la page décide quoi afficher (page 404, message).
- **Annulation** : `signal` (AbortController) est transmis à `$fetch`, prêt pour la recherche avec debounce (#3), où une réponse ancienne ne doit pas écraser une plus récente.

## 7. Tests

`tests/unit/dummyjsonApi.spec.ts` : construction des query params (valeurs omises, `order` par défaut), URL de chaque méthode, encodage du slug, transmission du `signal`, propagation des erreurs HTTP. `getProductsByIds` : appels lancés en parallèle, ordre conservé malgré des réponses dans le désordre, succès partiel (un 404 et une erreur réseau au milieu), tout en échec et liste vide, doublons, transmission de `select` et `signal`. Vérifié aussi contre la vraie API : `[16, 99999, 1, 16]` → produits 16 et 1 dans l'ordre, 99999 dans `missingIds`, 3 appels. Vérifié aussi à la main contre la vraie API : page 2 triée (12 produits sur 194), recherche `phone` (23 résultats), catégorie `mens-shirts` (5), produit 1, 24 catégories.
