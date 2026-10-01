# Recherche plein texte avec debounce

Issue #3. Fichiers : `utils/debounce.ts`, `utils/catalogSearch.ts`, `components/CatalogSearch.vue`, `pages/produits/index.vue`. Tests : `tests/unit/debounce.spec.ts`, `tests/unit/catalogSearch.spec.ts`, `tests/nuxt/CatalogSearch.spec.ts`, `e2e/recherche.spec.ts`.

## 1. Le parcours

```
frappe ─► debounce 300 ms ─► emit('search', q) ─► page : updateFilters({ q }) ─► navigateTo(?q=…)
                                                                                     │
           résultats ◄── useAsyncData (signal) ◄── filters = parseCatalogQuery(route.query)
```

Le champ ne fait **aucun appel API** : il émet la recherche, la page l'écrit dans l'URL, et la page se recalcule depuis l'URL comme pour la catégorie et le tri (#4). L'URL reste la seule source de vérité.

## 2. Debounce de 300 ms

Sans debounce, taper « phone » enverrait 5 requêtes (`p`, `ph`, `pho`, `phon`, `phone`). Avec : une seule, 300 ms après la dernière lettre.

```
frappes   p    ph   pho  phon phone
temps     0   100  200  300  400 ───── 300 ms ─────► 700 : 1 requête « phone »
```

`debounce` (`utils/debounce.ts`) est une fonction pure, sans Vue, avec trois méthodes :

| Méthode     | Usage                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| `flush()`   | Entrée dans le champ : la recherche part tout de suite, sans attendre 300 ms    |
| `cancel()`  | Composant démonté : pas de recherche fantôme après avoir quitté la page         |
| `pending()` | Une frappe attend-elle ? Sert à ne pas écraser le champ pendant la frappe (§ 5) |

**Alternative rejetée** : `useDebounceFn` de VueUse. Ajouter une dépendance pour 30 lignes, et la logique serait moins facile à tester avec de faux timers.

## 3. Anti-race : une réponse ancienne n'écrase jamais la plus récente

Le debounce ne suffit pas. Si on tape « pho », qu'on attend 300 ms, puis qu'on tape « ne », deux requêtes partent. Si celle de « pho » répond **après** celle de « phone » (réseau lent, serveur chargé), la liste afficherait les résultats de « pho » sous un champ qui dit « phone ».

**Solution : annuler la requête précédente.** `useAsyncData` (Nuxt 3.21) le fait avec l'option `dedupe: 'cancel'`, explicitement écrite dans la page :

1. quand l'URL change pendant une requête, Nuxt déclenche l'`AbortController` de la requête en cours et ignore sa réponse ;
2. son `signal` est transmis au handler, et on le passe à `useApi()` puis à `$fetch` : la requête **réseau** est réellement interrompue. Elle ne consomme plus de bande passante et ne peut pas arriver en retard.

| Stratégie                                      | Retenue ? | Pourquoi                                                            |
| ---------------------------------------------- | --------- | ------------------------------------------------------------------- |
| Annulation (`AbortController`)                 | ✅        | La réponse ancienne n'arrive jamais, et le réseau est libéré        |
| Numéro de requête (ignorer si pas la dernière) | ❌        | Protège l'affichage mais laisse les requêtes inutiles aller au bout |
| Désactiver le champ pendant la requête         | ❌        | Bloque la frappe : expérience dégradée, et le focus est perdu       |

**Vérifié dans un vrai navigateur** (`e2e/recherche.spec.ts`) : la réponse à « pho » est retardée de 2 s, celle de « phone » est immédiate. Après 2,5 s, l'écran affiche toujours « phone », et le `signal` de la requête « pho » a bien été déclenché. Playwright ne signale pas l'annulation d'une requête qu'il retient lui-même, donc le test l'observe depuis la page, sur le `signal` passé à `fetch`.

## 4. URL, page 1 et historique

- `?q=phone` dans l'URL : rechargement, lien partagé et bouton retour fonctionnent.
- **Retour à la page 1** : `updateFilters` (#4) le fait déjà pour tout changement autre que la page.
- **Les autres filtres sont gardés** : `?sortBy=price&order=desc&page=3` + « phone » → `?q=phone&sortBy=price&order=desc`.
- **Historique** : la première frappe ajoute une entrée, les suivantes la **remplacent** (`replace` si une recherche est déjà dans l'URL). Sinon « Précédent » repasserait par « phon », puis « pho »… Un seul « Précédent » ramène au catalogue d'avant la recherche.
- **URL canonique** : `?q=` vide ou `?q=+phone+` (envoyé sans JavaScript) redirige vers `?q=phone` ou `/produits` (302), comme le formulaire de tri de #4.

## 5. Le champ suit l'URL, sans écraser la frappe

Le champ a sa propre valeur (`text`), initialisée depuis l'URL et resynchronisée quand l'URL change sans lui (bouton retour, « Effacer les filtres »).

Piège évité : on tape « pho », la recherche part, on tape « n ». Puis l'URL passe à `?q=pho`. Une synchronisation naïve remettrait « pho » dans le champ et **effacerait le « n »**. Donc on ne resynchronise pas tant qu'une frappe attend (`pending()`). Ce cas est couvert par un test.

## 6. Recherche + catégorie : filtrage local

`/products/search` ignore le paramètre `category` (vérifié : `?q=phone&category=smartphones` renvoie aussi des accessoires). Dans ce seul cas :

1. récupérer **tous** les résultats de la recherche (`limit=0`), triés par l'API (`sortBy` fonctionne avec `limit=0`, vérifié) ;
2. filtrer par catégorie (`filterLocally`) ;
3. paginer localement (`localPage`), au même format que l'API.

Exemple : « phone » = 23 résultats, dont 16 dans Smartphones → 2 pages (12 + 4).

Coût : un seul appel, au plus 194 produits, et seulement quand recherche **et** catégorie sont combinées. Sans catégorie, la recherche reste paginée par l'API (12 produits par appel). `filterLocally` est conçu pour que #5 (prix) y ajoute ses bornes.

## 7. Sans JavaScript

Vrai `<form role="search" method="get" action="/produits">` : le navigateur l'envoie lui-même. La catégorie, le tri et les prix partent en champs cachés (`toCatalogQuery`), donc ils ne sont pas perdus. Le bouton « Rechercher » sert aussi à valider au clavier.

## 8. Accessibilité

- `role="search"` (point de repère pour les lecteurs d'écran), label visible relié, `type="search"`.
- Le focus **reste dans le champ** pendant la recherche. La page renvoyait le focus sur le `<h1>` à chaque changement de page ; la recherche ramène à la page 1 et aurait volé le focus à chaque frappe. Le focus ne bouge donc que si **seule** la page a changé (pagination).
- Résultats annoncés par la zone `role="status"` : « 23 produits pour « phone », page 1 sur 2 ».
- Aucun résultat : « Aucun produit ne correspond à « zzzz ». » + lien « Effacer la recherche », qui garde les autres filtres.
- Contrôle axe sur `?q=phone&category=smartphones` et `?q=zzzz` : zéro violation.

**WCAG 3.2.2** (pas de changement de contexte à la saisie) : la liste se met à jour **sur place**, le focus ne bouge pas et la page n'est pas rechargée. Ce n'est pas un changement de contexte. C'est différent des menus de #4, où chaque flèche du clavier aurait relancé le catalogue.

## 9. SEO

- Titre : « Recherche « phone » : Smartphones, page 2 ».
- `robots: noindex, follow` sur les pages de recherche : une page par mot tapé, ce qui ferait du contenu en double et des pages infinies à indexer. Les liens vers les produits restent suivis.

## 10. Tests

| Niveau                  | Fichier                            | Ce qui est vérifié                                                                                                                                              |
| ----------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitaire (faux timers)  | `tests/unit/debounce.spec.ts`      | 1 appel après la dernière frappe, valeur la plus récente, `flush`, `cancel`, `pending`                                                                          |
| Unitaire                | `tests/unit/catalogSearch.spec.ts` | Quand filtrer localement, filtre par catégorie, découpage en pages, hors bornes, aucun résultat                                                                 |
| Composant (Nuxt)        | `tests/nuxt/CatalogSearch.spec.ts` | Debounce dans le composant, Entrée immédiate, pas d'émission inutile, synchronisation sans écraser la frappe, champs cachés                                     |
| Navigateur (Playwright) | `e2e/recherche.spec.ts`            | 1 seule requête pour « phone », **anti-race avec réponse retardée**, page 1 + tri gardé, recherche + catégorie, aucun résultat, historique, **sans JavaScript** |
