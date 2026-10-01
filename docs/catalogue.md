# Catalogue paginé `/produits`

Issue #2. Fichiers : `pages/produits/index.vue`, `components/ProductCard.vue`, `components/ProductCardSkeleton.vue`, `components/CatalogPagination.vue`, `utils/pagination.ts`, `utils/product.ts`, tests `pagination.spec.ts` et `product.spec.ts`.

## 1. L'URL est la source de vérité

La page courante est lue dans `?page=` (`parseCatalogQuery`, #4), jamais stockée ailleurs. Conséquences :

- un lien partagé ou un favori rouvre la même page ;
- le bouton « Précédent » du navigateur fonctionne sans code en plus ;
- la page 1 n'a pas de `?page=` : une seule URL par page, pas de contenu dupliqué pour les moteurs de recherche.

`?page=abc`, `?page=-2` ou `?page=1.5` reviennent à la page 1 : une URL modifiée à la main ne fait jamais planter la page.

**Pagination DummyJSON** : page _n_ → `limit=12&skip=(n−1)×12`. Page 2 : `skip=12`, produits 13 à 24. 194 produits → 17 pages (16 pleines + 2 produits).

## 2. Rendu serveur, et donc sans JavaScript

`useAsyncData` s'exécute côté serveur au premier affichage : le HTML contient déjà les 12 produits. Ensuite, côté client, il se relance quand `?page=` change (`watch: [page]`).

La pagination est faite de **liens** (`<NuxtLink>`), pas de boutons :

| Liens                                              | Boutons (rejetés)              |
| -------------------------------------------------- | ------------------------------ |
| Fonctionnent sans JavaScript (vérifié)             | Ne font rien sans JavaScript   |
| Ouvrables dans un nouvel onglet                    | Non                            |
| Suivis par les moteurs : toutes les pages indexées | Seule la page 1 serait indexée |

Les autres paramètres de l'URL sont conservés dans les liens : la recherche (#3) et les filtres (#4, #5) ne sont pas perdus en changeant de page.

## 3. Les états

| État             | Affichage                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Chargement       | 12 squelettes (même grille que les cartes, pas de saut de mise en page), `aria-busy="true"`                  |
| Erreur réseau    | Message `role="alert"` + bouton « Réessayer » (`refresh()`)                                                  |
| Aucun produit    | « Aucun produit à afficher pour le moment. »                                                                 |
| Page hors bornes | `?page=99` : l'API répond 200 avec 0 produit. Message « le catalogue compte 17 pages » + lien vers la page 1 |

Les squelettes n'apparaissent qu'à la navigation côté client : au premier affichage, le serveur envoie directement les produits.

## 4. Pagination compacte

17 liens ne tiennent pas sur mobile. `paginationItems` affiche la première, la dernière, la courante et ses voisines :

```
page 1  : 1 2 … 17
page 9  : 1 … 8 9 10 … 17
page 4  : 1 2 3 4 5 … 17     ← pas « 1 … 3 4 5 … 17 »
```

Une ellipse ne remplace jamais **une seule** page : elle prendrait autant de place que le numéro, sans permettre d'y aller.

## 5. Accessibilité

- **Clavier** : liens natifs, focus visible. Après un changement de page, le focus va sur le titre `<h1>` : sinon l'utilisateur clavier reste en bas de page, sur un lien qui pointe maintenant ailleurs.
- **Lecteur d'écran** :
  - `<nav aria-label="Pagination">`, `aria-current="page"` sur la page courante, « Page 3 » plutôt que « 3 » ;
  - une zone `role="status"` annonce « Chargement des produits… » puis « 194 produits, page 2 sur 17 » ;
  - le badge se lit « Remise de −10 % », la note « Note : 4,5 sur 5 » (l'étoile est cachée) ;
  - l'image a un `alt` vide : le titre juste en dessous la décrit déjà, il serait lu deux fois.
- **Carte entièrement cliquable** : le lien du titre est étendu à toute la carte (`::after`), son nom accessible reste le titre.
- `prefers-reduced-motion` : les squelettes ne clignotent pas.

**Piège rencontré** : vue-router ignore la query pour savoir si un lien est actif. Tous les liens `/produits?page=…` recevaient `aria-current="page"`, et un lecteur d'écran annonçait chaque lien comme la page courante. Corrigé en fixant `aria-current` à la main.

## 6. SEO et performance

- `useSeoMeta` : titre « Produits, page 2 », description, Open Graph. Lien `canonical` par page.
- Images en `loading="lazy"` avec `width`/`height` : pas de décalage de mise en page pendant le chargement.
- La carte ne reçoit que les champs affichés (`Pick<Product, …>`) : elle pourra servir avec des produits partiels.

## 7. Branché sur #4

`pageFromQuery` a été remplacé par `parseCatalogQuery` de `utils/catalogQuery.ts` (#4), qui lit la page avec les mêmes règles, plus la catégorie, le tri, la recherche et les prix. Voir `docs/catalogue-url.md`.

## 8. Tests

- Unitaires : `paginationItems` (début, milieu, fin, pas d'ellipse pour une page, hors bornes), `discountBadge` (arrondi, sous 1 %), `formatRating`.
- Dans un vrai navigateur (Chromium, Playwright) :
  - 12 cartes ;
  - « Suivante » au clavier (Entrée) : 12 squelettes et `aria-busy`, puis page 2 dans l'URL et focus sur le titre ;
  - erreur réseau simulée puis « Réessayer » ;
  - retour arrière ;
  - JavaScript désactivé : produits affichés et pagination fonctionnelle ;
  - pas de défilement horizontal à 375 px.
