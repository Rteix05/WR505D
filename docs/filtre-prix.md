# Filtre prix min / max

Issue #5. Fichiers : `utils/priceFilter.ts`, `utils/catalogSearch.ts` (filtrage local, partagé avec #3), `utils/dummyjsonApi.ts` (`getAllProductSummaries`), `types/dummyjson.ts` (`ProductSummary`), `components/CatalogToolbar.vue`, `pages/produits/index.vue`. Tests : `tests/unit/priceFilter.spec.ts`, `tests/unit/catalogSearch.spec.ts`, `tests/unit/dummyjsonApi.spec.ts`, `tests/nuxt/CatalogToolbar.spec.ts`, `e2e/prix.spec.ts`.

## 1. Le problème

DummyJSON n'a **aucun paramètre de prix**. `/products?limit=12&skip=0` renvoie les 12 premiers produits du catalogue, quel que soit leur prix. Filtrer ces 12 produits côté client ne marche pas :

```
page 1 de l'API : 12 produits → 3 entre 10 € et 20 €  → la page 1 affiche 3 produits
page 2 de l'API : 12 produits → 0 entre 10 € et 20 €  → la page 2 est vide
total : inconnu                                          → impossible de dire « page 1 sur ? »
```

Le filtre doit donc s'appliquer **avant** la pagination, sur tous les produits concernés.

## 2. Les stratégies comparées

Mesures réelles (29/09/2026, `curl`), catalogue de 194 produits :

| Requête                                               | Taille  | Compressé (gzip) |
| ----------------------------------------------------- | ------- | ---------------- |
| Une page normale : `/products?limit=12`               | 18,8 Ko | **3,9 Ko**       |
| Tout le catalogue, produits complets : `?limit=0`     | 306 Ko  | 47,5 Ko          |
| **Tout le catalogue, 7 champs : `?limit=0&select=…`** | 42,8 Ko | **6,8 Ko**       |
| Une catégorie (Smartphones), 7 champs                 | 3,4 Ko  | 0,6 Ko           |
| Une recherche (« phone »), 7 champs                   | 5,1 Ko  | 0,9 Ko           |

| Stratégie                                                                   | Appels par page        | Pagination juste ?                                         | Retenue                                                                     |
| --------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| A. Filtrer la page reçue (12 produits)                                      | 1                      | ❌ pages vides, total faux                                 | ❌                                                                          |
| B. Enchaîner les pages de l'API jusqu'à en avoir 12 dans la fourchette      | 1 à 17, imprévisible   | ❌ total inconnu, page _n_ = refaire les _n−1_ précédentes | ❌                                                                          |
| C. Route serveur Nitro qui garde le catalogue en cache et filtre            | 1 (vers notre serveur) | ✅                                                         | ❌ plus de code et un cache à invalider, pour un gain faible à 194 produits |
| **D. Un appel `limit=0` avec `select` (7 champs), filtre + pagination ici** | **1**                  | ✅                                                         | ✅                                                                          |

**Stratégie D retenue :**

- **Un seul appel** par affichage, quel que soit le nombre de résultats.
- **6,8 Ko compressés** pour tout le catalogue : moins de deux fois une page normale. `select` ne demande que les champs d'une carte (`ProductSummary` : id, titre, prix, note, remise, miniature, catégorie). Sans `select`, ce serait 7 fois plus (47,5 Ko : descriptions, avis, images…).
- **Total exact**, donc pagination exacte (« page 2 sur 3 ») et liens de pagination de #2 inchangés.
- **Seulement quand c'est nécessaire** : sans filtre de prix, le catalogue reste paginé par l'API (12 produits par appel), comme en #2.
- **Le tri reste fait par l'API** (`sortBy` fonctionne avec `limit=0` et `select`, vérifié) : on filtre une liste déjà triée.
- **Le rendu serveur** fonctionne comme avant : le HTML arrive filtré, même sans JavaScript.

**Limite connue** : chaque changement de page refait l'appel (6,8 Ko). Un cache de la liste entre deux pages a été envisagé, puis écarté : il faudrait gérer son invalidation, et l'annulation des requêtes de #3 (une requête partagée annulée par un changement de page ferait échouer la suivante). Pour 6,8 Ko, ce n'est pas rentable. À 10 000 produits, on passerait à la stratégie C.

## 3. Le même mécanisme que la recherche + catégorie (#3)

#3 avait déjà besoin de « tout récupérer puis filtrer » : `/products/search` ignore `category`. #5 généralise ce chemin au lieu d'en créer un second :

```ts
needsLocalFiltering(filters) // recherche + catégorie, OU une borne de prix (même 0)
api.getAllProductSummaries({ q, category }, { sortBy, order, signal })
// q        → /products/search?q=…&limit=0&select=…
// category → /products/category/<slug>?limit=0&select=…
// sinon    → /products?limit=0&select=…
filterLocally(products, filters) // catégorie (si recherche) + prix
localPage(filtered, page) // 12 par page, au format ProductsResponse
```

Exemple : `?q=phone&category=smartphones&maxPrice=300` → 1 appel (« phone », 23 résultats, 0,9 Ko) → 16 smartphones → ceux à 300 € ou moins → page 1.

`ProductsResponse<P>` est devenu générique (`Product` par défaut) : la page affiche des `ProductSummary`, ce que renvoient à la fois le chemin local et l'API (un produit complet contient tous les champs d'un résumé). Aucun cast.

## 4. Comparer les prix en centimes

`inPriceRange` compare des **centimes entiers** (`toCents`, déjà utilisé par le panier), pas des euros. En JavaScript, `0.1 + 0.2` vaut `0.30000000000000004` : un produit pile à la borne pourrait être exclu à tort. Les bornes sont **incluses** : « jusqu'à 20 € » garde un produit à 20,00 €.

Le prix filtré est le **prix affiché** sur la carte (`price`), pas un prix recalculé avec la remise : l'utilisateur filtre sur ce qu'il voit.

## 5. Le formulaire

Deux champs « Minimum » et « Maximum » dans le formulaire de #4 (`CatalogToolbar`), groupés dans un `<fieldset>` avec la légende « Prix (€) ». Ils sont validés au clic sur « Appliquer », comme la catégorie et le tri (pas de changement à la frappe, WCAG 3.2.2).

| Choix                                           | Pourquoi                                                                                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type="text" inputmode="decimal"`, pas `number` | `type="number"` refuse la virgule dans certains navigateurs, et les flèches du clavier y changent la valeur par erreur. `inputmode` affiche quand même le pavé numérique sur mobile                                                        |
| Mêmes règles que l'URL                          | `parsePrice` de #4 est réutilisé (exporté) : `10`, `10.5`, `10,50` acceptés ; négatif, 3 décimales, `1e3` refusés                                                                                                                          |
| Erreur affichée au lieu d'être ignorée          | Dans l'URL, une valeur invalide est ignorée sans bruit. Dans le formulaire, l'utilisateur doit savoir pourquoi rien ne change : message `role="alert"`, relié au champ (`aria-describedby`, `aria-invalid`), focus sur le champ à corriger |
| Bornes inversées remises dans l'ordre           | Min 50 et max 10 : l'intention est claire, comme pour l'URL dans #4                                                                                                                                                                        |
| Vide = pas de borne, 0 = vraie borne            | `minPrice=0` reste dans l'URL (#4 l'avait prévu)                                                                                                                                                                                           |

Sans JavaScript, ce sont de vrais champs `name="minPrice"` et `name="maxPrice"` : le navigateur les envoie, et la page redirige vers l'URL canonique (#4). Ils remplacent les champs cachés que #4 avait prévus pour les prix.

## 6. Affichage

- Statut annoncé : « 31 produits entre 10,00 € et 20,00 €, page 1 sur 3 », « à partir de 100,00 € », « jusqu'à 10,00 € ».
- Aucun résultat : tous les filtres actifs sont rappelés (« Aucun produit dans Beauty à partir de 1 000,00 €. »), avec un lien « Effacer le filtre de prix » qui garde la recherche, la catégorie et le tri. Le prix est proposé en premier, car c'est le filtre le plus souvent trop étroit.
- SEO : `noindex, follow` sur les pages avec un prix, comme pour la recherche (une page par prix saisi).

## 7. Tests

| Niveau                  | Ce qui est vérifié                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unitaire                | Saisie (vide, virgule, refus), bornes incluses, une seule borne, **centimes à la borne (`0.1 + 0.2`)**, libellés, filtrage prix + catégorie, routes et `select` de `getAllProductSummaries`                              |
| Composant               | Label et légende, pré-remplissage avec la virgule, émission des bornes, inversion, **erreur reliée et focus**, resynchronisation avec l'URL                                                                              |
| Navigateur (Playwright) | URL et statut, tous les prix dans la fourchette, **dernière page complète avec 1 seul appel API**, prix + catégorie + tri, erreur et focus, Entrée au clavier, aucun résultat, **sans JavaScript**, axe : zéro violation |
