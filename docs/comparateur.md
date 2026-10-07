# Comparateur (F6) : choix techniques

## 1. Logique pure (#44)

Fichiers : `utils/compare.ts`, `tests/unit/compare.spec.ts`. Les deux signatures imposées par le sujet sont respectées :

```ts
export function parseCompareIds(raw: unknown, max = 3): number[]
export function toggleCompare(
  ids: number[],
  id: number,
  max = 3,
): { ids: number[]; rejected: boolean }
```

Deux fonctions utilitaires s'y ajoutent : `formatCompareIds` (valeur canonique de l'URL) et `isSameCompareSelection` (la sélection du cookie diffère-t-elle de celle d'un lien reçu ?). Constantes : `COMPARE_MAX = 3`, `COMPARE_COOKIE = 'compare'`.

### `parseCompareIds` : une seule lecture pour l'URL et le cookie

La même sélection arrive sous trois formes, toutes acceptées :

| Source                                        | Valeur reçue     |
| --------------------------------------------- | ---------------- |
| URL `?ids=3,17,42`                            | `"3,17,42"`      |
| URL avec paramètre répété `?ids=3,17&ids=42`  | `["3,17", "42"]` |
| Cookie `compare` relu en JSON par `useCookie` | `[3, 17, 42]`    |

Une seule fonction pour les deux sources garantit que la page (#47) et la sélection (#46) appliquent exactement les mêmes règles. Le paramètre est `unknown` : l'URL et le cookie viennent du navigateur, chaque valeur est vérifiée (narrowing), sans `any`.

Règles, dans cet ordre :

1. **Identifiant valide** = entier strictement positif. Une chaîne doit être écrite en chiffres uniquement (`/^\d+$/`, espaces autour tolérés) : `"1.5"`, `"-1"`, `"1e3"`, `"abc"`, `"0"` sont refusés. `Number("1e3")` vaudrait 1000 et `Number("")` vaudrait 0 : on ne laisse pas `Number` décider seul. Un nombre trop grand pour être exact (`Number.isSafeInteger`) est refusé.
2. **Doublons ignorés**, la première occurrence garde sa place : `"3,17,3"` → `[3, 17]`.
3. **Ordre conservé** : c'est l'ordre des colonnes du tableau.
4. **Au plus `max`**, comptés **après** le tri des invalides et des doublons : `"abc,1,1,2,3,4"` → `[1, 2, 3]`. Un identifiant invalide ne prend pas la place d'un valide.

La fonction ne lève jamais d'erreur : `null`, un objet ou un booléen donnent une sélection vide. C'est la condition pour l'exigence « aucune erreur 500 » de la page.

Les identifiants **inexistants** (`?ids=999999`) ne peuvent pas être détectés ici, sans appel réseau : la page les retire après le chargement (#47).

### `toggleCompare` : ajouter ou retirer

| Situation                   | Résultat                               |
| --------------------------- | -------------------------------------- |
| Produit absent, place libre | ajouté en fin, `rejected: false`       |
| Produit présent             | retiré, ordre des autres conservé      |
| Produit absent, 3 produits  | sélection inchangée, `rejected: true`  |
| Identifiant invalide        | sélection inchangée, `rejected: false` |

- **Retirer est toujours possible**, même comparateur plein : le test du « présent » passe avant celui du maximum.
- **`rejected` ne veut dire qu'une chose** : « comparateur plein ». C'est lui qui déclenchera l'annonce « Comparateur plein : retirez un produit pour en ajouter un autre ». Un identifiant invalide (bug d'appel) ne doit pas afficher ce message, qui serait faux.
- Fonction pure : le tableau reçu n'est jamais modifié, un nouveau tableau est renvoyé (le store et l'URL comparent les valeurs).

### `formatCompareIds` : une URL canonique

`[3, 17, 42]` → `"3,17,42"`, et `null` pour une sélection vide (la page est alors `/comparer`, sans paramètre). La page compare la valeur brute de `?ids=` à cette valeur canonique : si elles diffèrent (`?ids=3,,abc,3`), elle normalise l'URL avec `navigateTo(…, { replace: true })`. Même principe qu'au catalogue (#4) : une sélection = une seule URL. Un test vérifie l'aller-retour `parseCompareIds(formatCompareIds(ids))`.

### `isSameCompareSelection` : l'ordre ne compte pas

Le sujet impose de proposer « Remplacer ma sélection par celle-ci » quand le lien reçu diffère du cookie. Les mêmes produits dans un autre ordre ne sont **pas** une autre sélection : on ne propose rien dans ce cas.

### Tests

38 tests, couverture complète de `utils/compare.ts`. Tous les cas demandés par le sujet : doublons (`"5,5,5"`), ordre, dépassement du maximum, entrées invalides (`"abc"`, `"1,,2"`, tableau vide, `null`), plus `"-1"`, `"1.5"`, `"1e3"`, `"0"`, nombre trop grand, espaces, paramètre répété, cookie en tableau de nombres, aller-retour URL, retrait quand le comparateur est plein, tableau d'entrée jamais modifié.

## 2. Page `/comparer` (#47)

Fichiers : `pages/comparer.vue`, `utils/compare.ts` (`isCanonicalCompareQuery`, `sortCompareResults`), `e2e/comparer.spec.ts`.

### L'URL est la seule source de vérité

La page lit uniquement `?ids=` (`parseCompareIds`), jamais le cookie `compare` : un lien partagé affiche exactement les mêmes produits chez n'importe qui, en fenêtre privée, sans JavaScript (vérifié par Playwright). Le cookie sert à la sélection en cours du visiteur (#46) ; la page ne l'utilisera que pour proposer « Remplacer ma sélection par celle-ci », sans jamais l'écraser d'office.

### Chargement en parallèle, échecs isolés

Un appel par produit, tous lancés en même temps (`Promise.allSettled`), dans `useAsyncData` : côté serveur au premier affichage. `sortCompareResults` (fonction pure, testée) range chaque résultat :

| Résultat                     | Traitement                                                    |
| ---------------------------- | ------------------------------------------------------------- |
| Produit chargé               | affiché, dans l'ordre de l'URL                                |
| 404 (identifiant inexistant) | retiré de l'URL                                               |
| Autre échec (réseau, 500)    | gardé dans l'URL (le produit existe peut-être), « Réessayer » |

`allSettled` et pas `all` : avec `Promise.all`, un seul produit en échec ferait échouer toute la page. En attendant `getProductsByIds` (#45), la page appelle `useApi().getProduct` en parallèle ; le remplacement tient en une ligne.

### Normalisation de l'URL

Après le chargement, `isCanonicalCompareQuery` compare la valeur brute de `?ids=` à la forme canonique (sans invalides, doublons, identifiants au-delà de 3 ni inexistants). Si elles diffèrent, `navigateTo({ query }, { replace: true })` :

- côté serveur, c'est une **redirection HTTP** (vérifiée sans JavaScript) : jamais d'erreur 500 ;
- `replace` : l'URL corrigée remplace l'ancienne dans l'historique, « Précédent » ne ramène pas à l'URL invalide ;
- les autres paramètres de l'URL sont conservés ;
- s'il ne reste rien, l'URL devient `/comparer` et la page affiche « Aucun produit à comparer » avec un lien vers le catalogue.

`definePageMeta({ key: route.fullPath })` : passer d'une comparaison à une autre recrée la page, donc recharge et renormalise (comme la fiche produit).

### Copier le lien

`navigator.clipboard.writeText` avec l'URL canonique complète, puis « Lien copié dans le presse-papiers. » dans une zone `role="status"` (annoncée). **Repli** si l'API est absente (page non HTTPS, ancien navigateur) ou refusée : le lien s'affiche dans un champ en lecture seule avec un label, sélectionné et focalisé, et le message invite à le copier au clavier. Les deux cas sont testés par Playwright (le second en supprimant `navigator.clipboard`).

### SEO et accessibilité

Titre « Comparer : A, B, C », `noindex, follow` : une page par combinaison possible n'a pas sa place dans les moteurs de recherche. axe-core : zéro violation. L'affichage est provisoire (liste) : le tableau comparatif accessible arrive avec #48.

### Tests

- Unitaires : `isCanonicalCompareQuery` (8 cas à normaliser), `sortCompareResults` (ordre, 404 contre réseau ou 500).
- Playwright (`e2e/comparer.spec.ts`, 11 parcours) : produits dans l'ordre de l'URL, 4 URL invalides normalisées en 200, URL entièrement invalide → état vide, copie du lien (presse-papiers relu) et repli au clavier, axe, et sans JavaScript : produits dans le HTML et redirection du serveur.

### Reste à faire

- « Remplacer ma sélection par celle-ci » : dès que la sélection persistée (#46) est mergée.
- `getProductsByIds` (#45) à la place des appels `getProduct`.

## 3. Tableau comparatif (#48)

Fichiers : `components/compare/CompareTable.vue`, `utils/compareTable.ts`, `types/compareTable.ts`. Tests : `tests/unit/compareTable.spec.ts`, `e2e/tableau-comparatif.spec.ts`, `e2e/accessibilite.spec.ts`.

Le composant reçoit les produits en props (`CompareTableProduct`, les 14 champs affichés) et ne fait que l'affichage. Toute la logique est dans `buildCompareRows`, une fonction pure testée.

### Un vrai tableau

| Élément                                               | Pourquoi                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `<table>` + `<caption>` « Comparaison de 3 produits » | Le lecteur d'écran annonce un tableau, sa légende, et son nombre de lignes et de colonnes |
| `<th scope="col">` : image et titre du produit        | En lisant une cellule, le lecteur d'écran dit à quel produit elle appartient              |
| `<th scope="row">` : la caractéristique               | … et de quelle caractéristique il s'agit : « Prix, Powder Canister, 14,99 € »             |
| Image en `alt=""`                                     | Le titre juste en dessous la décrit déjà (même choix que les cartes du catalogue)         |

**Alternative rejetée** : une grille de `<div>` ou des cartes côte à côte. Visuellement proche, mais un lecteur d'écran lit alors les valeurs à la suite, sans dire à quel produit ni à quelle ligne elles correspondent.

### Les lignes

Prix, remise, note, disponibilité (`availabilityStatus`), stock, marque, catégorie, poids, dimensions (l × h × p), garantie, livraison. L'image et le titre sont dans les en-têtes de colonnes.

- **Textes en français** : la garantie et la livraison arrivent en anglais (« 1 year warranty », « Ships in 3-5 business days ») alors que la page est en `lang="fr"`. Un lecteur d'écran les prononcerait avec un accent français. `warrantyLabel` et `shippingLabel` traduisent les formats rencontrés dans les 194 produits (« 1 an », « Expédié sous 3 à 5 jours ouvrés »). Un format inconnu garde le texte d'origine plutôt qu'une traduction fausse.
- **Marque absente** (92 produits sur 194, voir #1) : « Non renseignée ».
- **Poids et dimensions sans unité** : l'API donne des nombres seuls (poids de 1 à 10 pour tous les produits, une moto pèse « 10 »). On les affiche tels quels, avec une note sous le tableau, plutôt que d'inventer une unité fausse.

### Meilleure valeur : un texte, pas seulement une couleur

| Ligne | Meilleure valeur | Libellé                 |
| ----- | ---------------- | ----------------------- |
| Prix  | la plus basse    | « Meilleur prix »       |
| Note  | la plus haute    | « Meilleure note »      |
| Stock | le plus élevé    | « Stock le plus élevé » |

Le libellé est écrit dans la cellule (WCAG 1.4.1 : l'information ne passe pas que par la couleur) : il est lu par les lecteurs d'écran et visible pour un daltonien. Le fond vert n'est qu'un repère en plus.

`bestIndexes(values, 'min' | 'max')` :

- **égalité partielle** (`[10, 5, 5]`) : les deux meilleurs sont signalés ;
- **tous égaux** ou **un seul produit** : rien n'est signalé. Dire « Meilleur prix » à tout le monde n'aide pas à choisir ;
- les prix sont comparés en **centimes** (`toCents`), comme partout dans le projet.

Exemple, produits 1, 2 et 3 : prix 9,99 / 19,99 / 14,99 € → « Meilleur prix » sur le mascara ; notes 2,6 / 2,9 / 4,6 → « Meilleure note » sur la poudre ; stocks 99 / 34 / 89 → « Stock le plus élevé » sur le mascara.

Les autres lignes (remise, marque, garantie…) ne sont pas classées : une remise plus forte sur un produit plus cher n'est pas « meilleure ».

### « Afficher uniquement les différences »

Une case à cocher masque les lignes où **tous** les produits ont le même texte (`row.same`). Avec les produits 1, 2 et 3 : « Disponibilité » (tous en stock) et « Catégorie » (tous Beauty) disparaissent.

- Le nombre de lignes masquées est annoncé (`role="status"`) : sans cette annonce, un lecteur d'écran ne saurait pas que le tableau a changé.
- Un seul produit : l'option n'apparaît pas (toutes les lignes seraient « identiques »).
- Plus aucune ligne : « Ces produits sont identiques sur toutes les caractéristiques. »
- **Seulement avec JavaScript** (`<ClientOnly>`) : sans JavaScript, la case ne ferait rien. Le tableau complet s'affiche alors, ce qui reste juste. Alternative écartée : mettre l'option dans l'URL (`?diff=1`), qui aurait marché sans JavaScript mais aurait ajouté un paramètre à normaliser dans la page de #47 pour une préférence d'affichage.

### Mobile (≤ 640 px)

- Le tableau **défile dans sa propre zone** (`overflow-x: auto`), jamais la page entière : vérifié à 375 px, `scrollWidth` de la page = largeur de l'écran.
- **Première colonne figée** (`position: sticky; left: 0`) : en faisant défiler, on sait toujours quelle ligne on lit. Le texte de la légende est figé aussi (le `sticky` est sur son contenu, la légende elle-même faisant toute la largeur du tableau).
- **Zone focalisable** (`tabindex="0"`, `role="region"` nommée par la légende) : au clavier, Tab atteint la zone et les flèches la font défiler. Sans ça, un utilisateur clavier ne pourrait pas voir la troisième colonne (règle axe `scrollable-region-focusable`).

### Tests

- Unitaires (26) : `bestIndexes` (min, max, égalité partielle, tous égaux, un seul produit), ordre et libellés des 11 lignes, meilleures valeurs avec les vrais produits 1, 2 et 3, lignes non classées, `same`, aucun produit, traductions de la garantie et de la livraison (dont format inconnu), catégorie, dimensions.
- Playwright (`e2e/tableau-comparatif.spec.ts`, 6 parcours) : légende et en-têtes de colonnes et de lignes, « Meilleur prix » dans la bonne colonne, option « différences » à la barre d'espace avec annonce puis retour, un seul produit, mobile 375 px (page sans débordement, zone défilante au clavier, première colonne collée au bord), et sans JavaScript (tableau complet, pas d'option).
- axe : `/comparer?ids=1,2,3` et `/comparer?ids=1` ajoutées à `e2e/accessibilite.spec.ts`, zéro violation.
- `e2e/comparer.spec.ts` (#47) : un produit comparé est maintenant un en-tête de colonne et non plus un élément de liste. La zone de statut de la copie du lien est la première du `<main>`, le tableau ayant la sienne.
