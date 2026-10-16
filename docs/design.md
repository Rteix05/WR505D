# Design du site : socle visuel et pages

Issue #68. Fichiers : `assets/css/main.css` (le socle), `nuxt.config.ts` (`css`), `layouts/default.vue`, `pages/index.vue`, et les styles de `components/` et `pages/`. Tests : `e2e/accueil.spec.ts`.

## 1. Le problème

Le site était fonctionnel et accessible, mais sans identité : fond blanc, liens bleus par défaut, accueil réduit à un titre et un lien. Les couleurs étaient écrites en dur dans chaque composant (16 valeurs différentes, dont `#1f2937` 20 fois), donc changer l'apparence voulait dire modifier une vingtaine de fichiers.

## 2. Un seul endroit : `assets/css/main.css`

Couleurs, typographie, espacements, arrondis et ombres sont des **variables CSS** déclarées une fois. Les composants n'écrivent plus de couleur : `var(--color-primary)`, `var(--space-4)`, `var(--radius-lg)`… Changer la marque, c'est modifier ce fichier.

Remplacement fait en une passe (une règle par couleur d'origine), vérifié ensuite par `grep` : plus aucune couleur en dur dans `components/`, `layouts/`, `error.vue` et les pages, **sauf `pages/comparer.vue`** (voir section 7).

| Variable                | Valeur    | Remplace                                |
| ----------------------- | --------- | --------------------------------------- |
| `--color-primary`       | `#147A39` | `#1f2937` (boutons)                     |
| `--color-surface`       | `#ffffff` | `#fff`                                  |
| `--color-focus`         | `#2563eb` | `#2563eb`                               |
| `--color-danger`        | `#b91c1c` | `#b91c1c`                               |
| `--color-border-strong` | `#6b7280` | `#6b7280`                               |
| `--color-surface-muted` | `#e8f3ea` | `#f3f4f6`, `#f9fafb`                    |
| `--color-text-muted`    | `#4b5563` | `#4b5563`                               |
| `--color-border`        | `#c8dccd` | `#ddd`, `#e5e7eb`, `#d1d5db`, `#9ca3af` |

## 3. Choix de style

Le skill UI/UX Pro Max (système de design « e-commerce, marketplace ») recommande : schéma de page **Marketplace** (bandeau avec recherche, catégories, produits, confiance), vert comme couleur principale, rose en accent, style « blocs » contrastés. Appliqué, avec trois écarts que j'ai dû justifier :

1. **Vert `#147A39` et pas `#15803D`.** Le vert recommandé donne **4,4:1** sur le fond vert pâle des liens actifs et des survols : sous le seuil de 4,5:1. axe-core l'a signalé dès le premier essai (11 contrôles d'accessibilité en échec, sur l'accueil, le catalogue, la connexion, le compte et le comparateur). `#147A39` est visuellement identique et donne 4,76:1.
2. **Accent `#BE185D` et pas `#EC4899`.** Avec du texte blanc, `#EC4899` ne donne que 3,5:1.
3. **Police système, pas Google Fonts.** Une requête tierce de moins (Lighthouse, LCP), pas de saut de texte au chargement, fonctionne hors ligne. Les polices recommandées demanderaient en plus un module ou un lien externe.

Contrastes calculés (WCAG AA : 4,5:1 pour le texte normal, 3:1 pour les composants) :

| Couple                                      | Rapport |
| ------------------------------------------- | ------- |
| Texte sur le fond de page                   | 15,6:1  |
| Texte atténué sur le fond de page           | 7,2:1   |
| Vert principal sur blanc                    | 5,4:1   |
| Vert principal sur le fond pâle des survols | 4,76:1  |
| Texte blanc sur le vert principal           | 5,4:1   |
| Texte blanc sur l'accent                    | 6,0:1   |
| Texte du pied de page sur son fond          | 8,0:1   |
| Danger sur blanc                            | 6,5:1   |
| Bordure des champs sur blanc                | 4,8:1   |

L'étoile des notes est orange, mais elle est décorative (`aria-hidden`) : la note est écrite à côté. Aucune information ne passe par la couleur seule : la page courante de la navigation a un fond, le stock est écrit, la sélection du comparateur a une coche.

## 4. Les pages

- **En-tête** : collant, logo, navigation (page courante signalée par un fond et une couleur), panier avec pastille du nombre. Sur écran étroit, le panier ne garde que l'icône et la pastille (le nom accessible « Panier, 2 articles » ne change pas) pour rester à côté du logo ; la navigation passe dessous. `scroll-padding-top` : un élément qui reçoit le focus ne passe pas sous l'en-tête collant (WCAG 2.4.11).
- **Pied de page** : fond vert foncé, livraison, liens.
- **Accueil** : bandeau avec recherche (un vrai formulaire GET, il fonctionne sans JavaScript), trois avantages, huit catégories, huit produits, puis l'historique.
  - **Avantages = les vraies règles de la boutique**, lues dans `utils/promotions.ts` (livraison 4,90 € offerte dès 80 € hors mobilier, remise beauté, code TROYES10). Si une règle change, la page suit : rien n'est écrit à la main.
  - **Catégories : liste fixe**, pas d'appel API. Les slugs DummyJSON ne changent pas, et un appel de plus sur l'accueil aurait ralenti la page. Chaque tuile mène au catalogue déjà filtré.
  - **Produits : « Les mieux notés »**, 8 produits triés par note côté API (`sortBy=rating`), chargés côté serveur donc dans le HTML sans JavaScript. Résultat gardé pendant la navigation (`getCachedData`) : revenir à l'accueil ne refait pas l'appel. Un test le prouve et **échoue quand on retire la mise en cache**.
  - Un échec de l'API n'efface pas la page : un message et un lien vers le catalogue.
- **Catalogue** : recherche et filtres regroupés dans un panneau, deux colonnes sur mobile.
- **Cartes produit** : ombre au survol, titre et prix plus lisibles, bouton « Comparer » toujours aligné en bas.
- **Fiche produit** : encadré d'achat (prix, stock, « Ajouter au panier » et « Comparer » côte à côte).
- **Panier, connexion, compte** : en cartes.
- Champs et boutons à **44 px** de haut au minimum (cible tactile).

## 5. Responsive et mouvement

- Mesuré à 375 px sur 7 pages : aucun débordement horizontal.
- Les grilles passent à deux colonnes sur mobile. Piège rencontré : la zone disponible fait 311 px à 375 px de large ; deux cartes de 9,5 rem (320 px avec l'espace) ne tenaient pas et donnaient une seule colonne (6 800 px de haut pour l'accueil). À 8,5 rem et 9 rem, deux colonnes.
- Transitions de 150 à 200 ms, **toutes coupées avec `prefers-reduced-motion`** (règle globale dans le socle).

## 6. Tests

- **Les 102 parcours Playwright existants passent sans modification**, dont le contrôle de contraste axe-core de chaque page : c'est lui qui a trouvé le problème du vert (section 3).
- `e2e/accueil.spec.ts` (9 tests) : bandeau, avantages (montants réels), 8 catégories, 8 produits ; **produits triés par note décroissante** (sinon l'ordre pourrait être celui du catalogue sans que rien ne le signale) ; catégorie → catalogue filtré ; produit → fiche ; « Voir tout le catalogue » ; recherche au clavier ; **aucun rechargement des produits en revenant à l'accueil** ; aucun débordement à 375 px ; sans JavaScript (produits, catégories et recherche).

## 7. Ce qui n'est pas fait

- **Page `/comparer` et tableau comparatif** : la PR #64 (Radouan) réécrit cette page et ajoute le tableau. Les restyler maintenant aurait créé un conflit. À faire après son merge : la page garde pour l'instant ses anciennes couleurs.
- **Mode sombre** : non demandé par l'issue.
- Pas de photo d'ambiance ni d'illustrations : le site n'a pas d'images à lui, les produits viennent de l'API.
