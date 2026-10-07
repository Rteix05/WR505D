# Comparateur : sélection (bouton, barre, cookie)

Issue #46. Fichiers : `stores/compare.ts`, `components/compare/CompareButton.vue`, `components/compare/CompareBar.vue`, `utils/compareSelection.ts`, `types/compare.ts`, `tests/unit/compareSelection.spec.ts`, `tests/nuxt/compareStore.spec.ts`, `e2e/comparateur.spec.ts`.

S'appuie sur la logique de #44 (`toggleCompare`, `parseCompareIds`, `formatCompareIds`, voir [docs/comparateur.md](comparateur.md)) : rien n'est réécrit. La page `/comparer` (#47) lit ses produits dans l'URL, ce store fournit la sélection et le lien.

## 1. Découpage

| Élément                  | Rôle                                                                        |
| ------------------------ | --------------------------------------------------------------------------- |
| `stores/compare.ts`      | Sélection (identifiants), cookie `compare`, phrase à annoncer               |
| `<CompareButton>`        | Bouton bascule « Comparer », sur chaque carte et sur la fiche produit       |
| `<CompareBar>`           | Barre « Comparer (2/3) » : miniatures, retrait, lien vers `/comparer?ids=…` |
| `utils/compareSelection` | Textes et noms accessibles (fonctions pures, testées)                       |

La barre est dans le layout : elle reste visible quand on passe du catalogue à une fiche, puis à `/comparer`.

## 2. Le cookie `compare`

- **Identifiants uniquement** (consigne du sujet) : `1,2,3`. Pas de titre ni d'image. Vérifié par un test et par Playwright.
- **Une seule ref pour tout le store** : deux `useCookie('compare')` seraient deux refs qui se désynchronisent (même piège que `useAuthCookies`, voir `docs/refresh-token.md`).
- **Lu au rendu serveur** : la sélection est dans le HTML (boutons déjà « pressés », barre déjà là), sans saut à l'hydratation. Vérifié avec JavaScript désactivé.
- **Validé à la lecture** (`parseCompareIds`) : un cookie corrompu ou modifié à la main est ignoré, sans erreur. `abc,,-5,1.5,2,2,9,8,7` donne `[2, 9, 8]` (valides gardés dans l'ordre, doublons retirés, 3 au plus), et `[1,` donne `[]`.
- **`sameSite: lax`, 30 jours, `secure` en production.** Quand la sélection devient vide, le cookie est **supprimé** (`null`) au lieu d'être renvoyé vide à chaque requête.
- Un seul produit : `useCookie` relit `7` comme un nombre et pas comme un texte. `parseCompareIds` accepte les deux (testé).

## 3. Titre et miniature : en mémoire, pas dans le cookie

La barre affiche un titre et une miniature, que le cookie n'a pas.

- **Au clic** sur une carte ou sur la fiche, on a déjà le produit : le store garde `{ id, title, thumbnail }` en mémoire (`known`). Aucun appel réseau.
- **Après un rechargement**, il ne reste que les identifiants. La barre recharge ceux dont elle ignore le titre : `GET /products/{id}?select=title,thumbnail`, en parallèle (3 appels au plus, quelques centaines d'octets chacun). `useAsyncData` fait attendre le serveur : la page arrive avec les miniatures, sans « Produit n° 1 » qui clignote. Vérifié sans JavaScript.
- **Un identifiant que l'API ne connaît pas (404)** : cookie ancien ou modifié à la main. Il est retiré de la sélection, sans annonce. Réutilise `sortCompareResults` de #47.
- **Une autre erreur (réseau)** : l'identifiant est gardé (le produit existe peut-être) avec un repli « Produit n° 12 ».
- À remplacer par `getProductsByIds` quand #45 sera mergée (une seule méthode pour tout le site, voir CLAUDE.md).

Alternative rejetée : mettre le titre et l'image dans le cookie. C'est contraire au sujet (identifiants uniquement), et trois produits avec leur image dépasseraient vite les 4 Ko.

## 4. Le bouton bascule

- `<button aria-pressed>` : le libellé « Comparer » **ne change jamais**, c'est `aria-pressed` qui porte l'état. Un lecteur d'écran lit « Comparer Mascara, bouton bascule, activé ». Changer le texte en « Retirer » en plus de `aria-pressed` annoncerait l'état deux fois, dont une à l'envers.
- **Nom accessible : « Comparer Mascara »**. Il contient le texte visible « Comparer » (WCAG 2.5.3), et distingue les 12 boutons d'une page (douze « Comparer » identiques seraient inutilisables à la commande vocale ou en liste de boutons).
- **L'état se voit sans couleur** : bouton plein avec une coche, pas seulement un changement de teinte.
- **Jamais désactivé**, même comparateur plein : un bouton `disabled` n'annonce rien et perd le focus. Le clic est refusé et expliqué (section 5).
- `z-index: 1` : sur une carte, un lien couvre toute la surface (`::after`). Sans ça, le bouton ne recevrait aucun clic.
- 44 px de haut au minimum (zone de clic au doigt) et contour de focus visible.

## 5. Annonce : `aria-live`

Phrases (fonction `compareToggleMessage`, testée) :

| Action            | Annonce                                                         |
| ----------------- | --------------------------------------------------------------- |
| Ajout             | « Mascara » ajouté au comparateur (2/3).                        |
| Retrait           | « Mascara » retiré du comparateur (1/3).                        |
| 4ᵉ produit refusé | Comparateur plein : retirez un produit pour en ajouter un autre |

Le dernier texte est celui de l'issue, mot pour mot, vérifié par un test unitaire et par Playwright.

- La zone `aria-live="polite"` est **toujours présente dans la page**, même barre vide : un lecteur d'écran n'annonce de façon fiable que les changements d'une zone qui existait déjà.
- Elle est **dans la barre mais sert à tout le site** : le message vient du store, pas d'un composant.
- **Pas de `role="status"`.** Premier essai avec `role="status"` : 18 tests existants (catalogue, filtres, prix, recherche) ont échoué, car ils cherchent `getByRole('status')` en attendant **un seul** élément, et ma zone, présente sur toutes les pages, en ajoutait un deuxième. `aria-live="polite"` fait la même chose pour un lecteur d'écran, sans entrer en collision avec leurs sélecteurs. Leçon : un élément global qui a un rôle ARIA courant peut casser les tests des autres.

## 6. La barre

- **`position: sticky; bottom: 0`, pas `fixed`.** Une barre fixe recouvre la fin de la page et demande une marge de compensation (et le pied de page). Collante, elle reste dans le flux entre le contenu et le pied de page : à la fin du défilement, rien n'est caché.
- **`scroll-padding-bottom`** quand la barre est là (`:root:has(.compare-bar)`) : sinon un élément qui reçoit le focus au clavier pourrait se retrouver sous la barre (WCAG 2.4.11).
- **Petit écran** : en dessous de 40 rem, miniatures sur une ligne et lien pleine largeur. Les titres ne sont plus affichés mais restent lus par les lecteurs d'écran et nommés dans les boutons de retrait. Mesuré à 375 px : la première version prenait 36 % de la hauteur de l'écran, la compacte 19 %.
- **Retrait au clavier** : le bouton cliqué disparaît, donc le focus passe au bouton de retrait suivant (ou au précédent). Sans ça, il retomberait en haut de la page.
- Boutons de retrait de 44 px, avec un nom qui cite le produit : « Retirer Mascara du comparateur ».
- Transitions de 150 ms, désactivées avec `prefers-reduced-motion`.

## 7. Tests

Automatiques :

- `tests/unit/compareSelection.spec.ts` (8 tests) : libellé « Comparer (2/3) », les trois phrases annoncées (dont le texte imposé), noms accessibles, lien vers `/comparer?ids=…`.
- `tests/nuxt/compareStore.spec.ts` (14 tests, environnement Nuxt, `useCookie` remplacé par un stockage en mémoire) : départ vide, ajout et retrait, **4ᵉ refusé sans changer le cookie**, retirer reste possible plein, cookie supprimé à la fin, persistance entre deux visites, cookie corrompu, un identifiant seul, titres jamais dans le cookie, identifiants sans titre puis rechargés, identifiant 404 retiré, options du cookie (`lax`, 30 jours).

Pourquoi simuler `useCookie` : le cookie est `secure`, un navigateur de test en `http` ne le renvoie pas, et le test lirait un cookie vide.

De bout en bout, `e2e/comparateur.spec.ts` (Playwright, build de production, 9 tests) :

- ajout, retrait depuis la barre et depuis la carte, annonce, cookie en identifiants ;
- 4ᵉ refusé et annoncé, bouton non désactivé, une place libérée après un retrait ;
- persistance au rechargement, avec titres et miniatures rechargés ;
- navigation fiche produit → catalogue → `/comparer?ids=1,2` ;
- clavier : Entrée et Espace sur « Comparer », retrait au clavier, focus qui reste dans la barre ;
- cookie corrompu (`abc,,-5,1.5`) ; identifiant 9999 retiré ;
- sans JavaScript : boutons pressés, barre, miniatures déjà dans le HTML du serveur ;
- axe-core avec des produits sélectionnés et la barre affichée.

Piège rencontré avec axe : il signalait un contraste insuffisant sur le bouton cliqué en dernier. Il analysait la page en plein fondu de 150 ms, avec une couleur intermédiaire qui n'existe plus ensuite. Le test passe en mouvement réduit (que le composant respecte déjà) : c'est un artefact de mesure, pas un défaut du bouton.

## 8. Reste à faire

- Remplacer les appels `select=title,thumbnail` par `getProductsByIds` dès que #45 est mergée.
- Page `/comparer` (#47) : elle pourrait proposer la sélection du cookie quand l'URL en contient une autre (`isSameCompareSelection` est prêt).
