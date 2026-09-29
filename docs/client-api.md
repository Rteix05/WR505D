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

| Méthode                               | Route DummyJSON                 |
| ------------------------------------- | ------------------------------- |
| `getProducts(params)`                 | `GET /products`                 |
| `searchProducts(q, params)`           | `GET /products/search?q=`       |
| `getProductsByCategory(slug, params)` | `GET /products/category/{slug}` |
| `getProduct(id)`                      | `GET /products/{id}`            |
| `getCategories()`                     | `GET /products/categories`      |

`params` = `limit`, `skip`, `sortBy`, `order`, `signal`. Exemple, page 2 triée par prix décroissant : `getProducts({ limit: 12, skip: 12, sortBy: 'price', order: 'desc' })` → `/products?limit=12&skip=12&sortBy=price&order=desc`.

## 5. Cas limites

- **`order` sans `sortBy`** : ignoré par l'API, donc pas envoyé. `sortBy` seul envoie `order=asc`, pour une URL explicite.
- **Slug de catégorie venant de l'URL** : encodé (`encodeURIComponent`). `../auth/me` devient `..%2Fauth%2Fme` et ne peut pas viser une autre route.
- **Produit introuvable** (404) : l'erreur remonte telle quelle, la page décide quoi afficher (page 404, message).
- **Annulation** : `signal` (AbortController) est transmis à `$fetch`, prêt pour la recherche avec debounce (#3), où une réponse ancienne ne doit pas écraser une plus récente.

## 6. Tests

`tests/unit/dummyjsonApi.spec.ts` : construction des query params (valeurs omises, `order` par défaut), URL de chaque méthode, encodage du slug, transmission du `signal`, propagation des erreurs HTTP. Vérifié aussi à la main contre la vraie API : page 2 triée (12 produits sur 194), recherche `phone` (23 résultats), catégorie `mens-shirts` (5), produit 1, 24 catégories.
