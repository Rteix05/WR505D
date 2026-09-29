# L'URL, source de vérité du catalogue : choix techniques

Issue #4 (partie pure). Fichiers : `types/catalog.ts`, `utils/catalogQuery.ts`, `tests/unit/catalogQuery.spec.ts`. La page `/produits` (#2) branchera ces fonctions.

## 1. Le principe

L'état du catalogue (page, recherche, catégorie, tri, prix) n'est stocké **que** dans l'URL :

```
/produits?q=creme&category=skin-care&sortBy=price&order=asc&minPrice=5&maxPrice=30&page=2
```

- La page lit `route.query` → `parseCatalogQuery` → filtres → appel API.
- Un clic sur un filtre calcule les nouveaux filtres (`updateFilters`) → `toCatalogQuery` → `navigateTo({ query })`.
- La page ne garde **aucune copie** des filtres dans un `ref` : l'URL change, la page se recalcule.

Conséquences, exigées par le sujet :

- **Rechargement** : l'URL est relue, même vue.
- **Bouton retour** : chaque changement de filtre est une entrée d'historique, le navigateur revient à l'URL précédente, donc aux filtres précédents.
- **Lien partagé** : toute la vue est dans le lien.
- **SSR** : le serveur lit la même URL, le HTML arrive déjà filtré, même sans JavaScript.

Avec une copie dans un `ref`, il y aurait deux sources de vérité à synchroniser, et chaque oubli donnerait une URL qui ne correspond pas à l'écran.

## 2. Noms des paramètres

| Paramètre  | Exemple   | Issue | Par défaut (absent de l'URL) |
| ---------- | --------- | ----- | ---------------------------- |
| `page`     | `2`       | #2    | 1                            |
| `q`        | `mascara` | #3    | aucune recherche             |
| `category` | `beauty`  | #4    | toutes                       |
| `sortBy`   | `price`   | #4    | ordre de l'API               |
| `order`    | `desc`    | #4    | `asc`                        |
| `minPrice` | `10`      | #5    | pas de minimum               |
| `maxPrice` | `49.99`   | #5    | pas de maximum               |

`sortBy` et `order` reprennent les noms de DummyJSON (`/products?sortBy=price&order=desc`) : pas de traduction entre l'URL et l'API. Ces noms sont à valider avec Radouan (#3, #5), qui lit et écrit les mêmes.

## 3. Lecture : l'URL n'est pas fiable

L'URL vient de l'utilisateur : lien modifié à la main, ancien lien, lien malveillant. `parseCatalogQuery` reçoit donc `Record<string, unknown>` et valide chaque valeur. Règle : **une valeur invalide est ignorée** (valeur par défaut), elle ne fait jamais planter la page ni partir une requête absurde vers l'API.

| Cas                          | Exemple                    | Résultat       | Pourquoi                                                             |
| ---------------------------- | -------------------------- | -------------- | -------------------------------------------------------------------- |
| Paramètre répété             | `?page=2&page=5`           | page 2         | vue-router donne alors un tableau : on garde la première valeur      |
| Page non entière ou négative | `?page=2.5`, `?page=-1`    | page 1         | seuls les chiffres sont acceptés (`/^\d+$/`, refuse aussi `1e3`)     |
| Catégorie hors format slug   | `?category=../admin`       | toutes         | la valeur finit dans l'URL de l'API : format strict `a-z0-9` et `-`  |
| Tri inconnu                  | `?sortBy=stock`            | ordre de l'API | seuls `price`, `rating`, `title` sont acceptés                       |
| Prix avec virgule            | `?minPrice=10,50`          | 10,5 €         | réflexe français, accepté                                            |
| Prix négatif ou 3 décimales  | `?minPrice=-5`             | pas de minimum | un prix a au plus 2 décimales                                        |
| Bornes inversées             | `?minPrice=50&maxPrice=10` | 10 € à 50 €    | l'intention est claire : on remet dans l'ordre plutôt que 0 résultat |
| Recherche très longue        | 300 caractères             | coupée à 100   | évite d'envoyer n'importe quoi à l'API                               |

Les types sont vérifiés étape par étape (`firstString`, puis un test par champ), sans `any`. `isOneOf` est un type guard : après `isOneOf(sortBy, SORT_FIELDS)`, TypeScript sait que `sortBy` est un `SortField`.

La page trop grande (`?page=99` sur 17 pages) ne peut pas être corrigée ici : il faut connaître le total. `clampPage(page, total)` servira à la page une fois la réponse de l'API reçue.

## 4. Écriture : une vue = une URL

`toCatalogQuery` :

- **omet les valeurs par défaut** : la première page sans filtre est `/produits`, pas `/produits?page=1&order=asc` ;
- **écrit les clés toujours dans le même ordre** ;
- n'écrit `order` que s'il y a un `sortBy` (un ordre sans tri ne change rien) ;
- garde `minPrice=0` : 0 est un vrai filtre, pas une absence de filtre (`!== null`, pas un test « falsy »).

Pourquoi : si une même vue avait plusieurs URL, les moteurs de recherche verraient du contenu dupliqué, et deux liens vers la même page ne seraient pas identiques. Un test vérifie l'aller-retour : `parseCatalogQuery(toCatalogQuery(filtres))` redonne exactement les filtres de départ.

## 5. Retour à la page 1 (`updateFilters`)

Changer de recherche, de catégorie, de tri ou de prix renvoie à la page 1. Sinon, on resterait page 5 d'une recherche qui n'a peut-être plus que 2 pages. Seul un changement de page seule conserve les autres filtres.

La fonction renvoie un nouvel objet et ne modifie pas celui reçu (fonction pure).

## 6. Le menu de tri

Un seul `<select>` est plus simple au clavier et au lecteur d'écran que deux (champ + ordre). `SORT_OPTIONS` décrit chaque option avec un libellé français (« Prix croissant », « Mieux notés »…). `sortOptionFor` et `sortFromOption` font la conversion dans les deux sens. Un test vérifie que chaque option fait l'aller-retour.

« Mieux notés » est `rating` **décroissant** : c'est ce qu'on attend en premier d'un tri par note.

## 7. Paramètres de l'API

`paginationParams(page)` donne `limit` et `skip` (page 3 → `skip: 24`), `sortParams(filters)` donne `sortBy` et `order`, ou rien sans tri. Vérifié sur l'API réelle : `sortBy` et `order` fonctionnent sur `/products` et sur `/products/category/<slug>`.

La combinaison recherche + catégorie + prix (DummyJSON ne sait pas filtrer une recherche par catégorie ni par prix) relève de la stratégie de #2, #3 et #5 : ces fonctions ne font aucune supposition dessus.

## 8. Tests

50 tests dans `tests/unit/catalogQuery.spec.ts` : lecture d'une URL complète, chaque cas du tableau de la section 3, ordre des clés, aller-retour, retour à la page 1, menu de tri, pagination (194 produits → 17 pages). Couverture : 100 % des lignes.

## 9. Reste à faire (après #1 et #2)

- Liste des catégories chargée depuis `/products/categories`.
- Dans `/produits` : `<select>` de catégorie et de tri avec labels, lecture de `route.query`, `navigateTo({ query: toCatalogQuery(...) })` à chaque changement.
- Vérifier rechargement, bouton retour, lien partagé et rendu sans JavaScript.
