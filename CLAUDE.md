# ChampaShop : guide de l'équipe et consignes pour l'IA

Projet fil rouge Nuxt 3, Vue 3, TypeScript strict, Pinia, Vitest. Dépôt `Rteix05/WR505D`, équipe de trois : Rafael (`Rteix05`), Radouan (`rdn244`), Marwan (`Marwan550-mmi`).

Seul document de référence de l'équipe, pour les humains comme pour l'IA :

- **vous** : le « Guide GitFlow pas à pas » donne toutes les commandes, de l'installation au merge ;
- **l'IA** : Claude Code lit ce fichier automatiquement. Avec un autre outil (ChatGPT, Copilot…), copier-coller son contenu en début de conversation.

Au début d'une session, identifier l'étudiant (`git config user.name` ou lui demander) et l'issue traitée. On traite **une issue à la fois**.

## Avant de coder

- Lire le sujet (PDF à la racine, texte extractible avec `pdftotext -layout`) et l'issue (`gh issue view <n°>`).
- Vérifier les vraies réponses DummyJSON (`curl`) avant d'écrire les types.
- Si l'issue dépend d'un travail pas encore mergé (voir « Qui attend qui »), le dire et proposer une solution sans conflit.
- Réutiliser l'existant (section suivante, README, `docs/`) au lieu de le réécrire.

## Git (GitFlow)

- Branche `feature/<n°>-<description>` créée depuis `develop` à jour.
- Commits Conventional Commits en français (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`), découpés par étape (types et utils, logique, page, tests, docs), jamais un seul gros commit.
- **Aucune** ligne `Co-Authored-By` Claude ni « Generated with Claude Code », ni dans les commits ni dans les PR.
- Commit, push et PR uniquement quand l'étudiant le demande.

## Guide GitFlow pas à pas

Personne ne travaille directement sur `main` ni sur `develop`. Une issue = une branche = une Pull Request, relue par un coéquipier avant d'entrer dans `develop`.

### 1. Première fois : installer le projet

```bash
git clone https://github.com/Rteix05/WR505D.git
cd WR505D
git config user.name "<ton pseudo GitHub>"
git config user.email "<ton email GitHub>"
npm install
npm run dev          # site sur http://localhost:3000
```

### 2. Commencer une issue (exemple : #1)

```bash
git switch develop
git pull                              # récupérer le travail des autres
git switch -c feature/1-types-api     # feature/<n°>-<description>
```

### 3. Travailler et commiter

Plusieurs petits commits, chacun avec un préfixe :

```bash
git add types/dummyjson.ts
git commit -m "feat: types des réponses DummyJSON"
```

| Préfixe     | Pour                                     |
| ----------- | ---------------------------------------- |
| `feat:`     | une fonctionnalité                       |
| `fix:`      | une correction                           |
| `test:`     | des tests                                |
| `docs:`     | de la documentation                      |
| `refactor:` | réorganiser du code sans changer l'effet |
| `chore:`    | configuration, outils                    |

Avant de pousser, tout doit passer (si le format échoue : `npm run format`) :

```bash
npm run lint && npm run format:check && npm run typecheck && npm run test && npm run build
```

### 4. Pousser et ouvrir la Pull Request

```bash
git push -u origin feature/1-types-api
```

Sur GitHub, « Compare & pull request » :

- **base : `develop`** (jamais `main`) ;
- remplir le template, écrire `Closes #1` (l'issue se fermera au merge) ;
- label `feature`, milestone de la semaine en cours (« Semaine 2 »…), s'assigner la PR ;
- demander une review à un coéquipier.

Il faut la CI verte et 1 approbation : on ne peut pas merger sa propre PR sans.

### 5. Corriger après une review

Lire **tous** les commentaires : le message de review, les commentaires sur les lignes (onglet « Files changed ») et ceux de la conversation. Pour chaque point : corriger, ou répondre pourquoi on garde le code tel quel. Rien ne reste sans réponse, même les remarques « non bloquantes ».

Rester sur sa branche, modifier, puis :

```bash
git add .
git commit -m "fix: <ce qui a été corrigé>"
git push              # la PR se met à jour toute seule
```

Puis répondre sous chaque commentaire (« Corrigé dans <commit> » ou l'explication). Si la PR a déjà été mergée avec des remarques non bloquantes, les traiter dans une issue de suivi (ex. #25).

### 6. « This branch has conflicts »

`develop` a changé pendant qu'on travaillait :

```bash
git switch develop && git pull
git switch feature/1-types-api
git merge develop       # pas de rebase : la branche est déjà poussée
```

Dans chaque fichier en conflit, garder ce qu'il faut entre `<<<<<<<` et `>>>>>>>`, supprimer ces marqueurs, puis :

```bash
git add <fichier> && git commit --no-edit && git push
```

Conflit fréquent : `docs/ai-usage/<prenom>.md`, quand deux branches ajoutent une ligne au tableau. Garder toutes les lignes, dans l'ordre des dates, puis `npm run format`.

### 7. Après le merge

Sur GitHub : « Create a merge commit » (seule option autorisée), puis « Delete branch ». En local :

```bash
git switch develop
git pull
git branch -d feature/1-types-api
```

Puis reprendre à l'étape 2 avec l'issue suivante.

### Revoir la PR d'un coéquipier

Onglet « Files changed » : commenter les lignes (pourquoi ce choix ? cas limite oublié ? nom peu clair ?), tester la branche en local (`git switch <branche> && npm run dev`), puis « Review changes » → « Approve » ou « Request changes ». Des commentaires argumentés, pas un simple « LGTM » : c'est noté.

### Release de fin de semaine (v0.1.0, v0.2.0, v1.0.0)

Quand toutes les issues de la semaine sont mergées dans `develop`. Pilotée par un seul membre ; `X.Y.Z` = la version (ex. `0.1.0`).

**Avant de commencer**, vérifier la checklist du jalon :

- toutes les issues du milestone fermées par une PR relue ;
- CI verte sur `develop` (les deux jobs) ;
- aucun « À compléter » dans `docs/ai-usage/*.md` et dans le README ;
- URL du catalogue testée sans JavaScript.

**1. Branche de release** (gel des fonctionnalités : seulement version, CHANGELOG et corrections) :

```bash
git switch develop && git pull
git switch -c release/vX.Y.Z
npm version X.Y.Z --no-git-tag-version    # écrit "version" dans package.json
# compléter CHANGELOG.md : section [X.Y.Z] avec la date, une ligne par issue (#issue, PR #n°)
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: version X.Y.Z et CHANGELOG"
git push -u origin release/vX.Y.Z
```

**2. PR `release/vX.Y.Z` → `main`**, titre `release: vX.Y.Z`, corps = la section du CHANGELOG. CI verte + 1 approbation, puis « Create a merge commit ». **Ne pas supprimer la branche** : elle sert à l'étape 4.

**3. Tag annoté et GitHub Release** sur le commit de merge de `main` :

```bash
git switch main && git pull
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <section du CHANGELOG>
```

Le merge dans `main` déclenche le déploiement de production Vercel : vérifier le site en ligne.

**4. Retour dans `develop`** : PR `release/vX.Y.Z` → `develop` (« Create a merge commit », 1 approbation), puis supprimer la branche de release.

### Hotfix (bug en production)

```bash
git switch main && git pull
git switch -c hotfix/<description>
# correction + test qui reproduit le bug, puis ligne dans CHANGELOG.md
npm version patch --no-git-tag-version   # X.Y.Z → X.Y.(Z+1), ex. 0.1.0 → 0.1.1
git add <fichiers modifiés et nouveaux> package.json package-lock.json CHANGELOG.md
git commit -m "fix: <description>"
git push -u origin hotfix/<description>
```

- `npm version patch` et pas `npm version X.Y.Z+1` : npm lit `+1` comme une métadonnée de build (SemVer), pas comme une addition, et répond « Version not changed ».
- `git add` explicite et pas `git commit -am` : `-a` ignore les **nouveaux** fichiers, le test qui reproduit le bug ne serait pas commité.

**Hotfix imposé (semaine 2)** : l'enseignant ouvre une issue `bug-prod` à un moment non annoncé, l'équipe a **24 heures ouvrées**. Assigner l'issue à un membre et la faire relire par un autre. Créer la branche **depuis `main`, jamais depuis `develop`** : le travail en cours de `develop` ne doit pas partir en production, c'est vérifié dans le graphe Git. Le test qui reproduit le bug (non-régression) est obligatoire, et il faut vérifier le site déployé après le merge.

PR `hotfix/<description>` → `main` (label `bug-prod`), merge, tag annoté de la nouvelle version (celle affichée par `npm version patch`, ex. `v0.1.1`) et GitHub Release comme à l'étape 3, puis PR `hotfix/<description>` → `develop` pour ne pas perdre la correction.

### À ne jamais faire

- Commiter directement sur `main` ou `develop` (branches protégées).
- `git push --force`.
- Mettre plusieurs issues dans une même branche.

## Code

- Zéro `any` (règle ESLint en erreur) : `unknown` + narrowing. Types partagés dans `types/`.
- Logique métier = fonctions pures dans `utils/`, sans Vue ni Pinia, testées dans `tests/unit/`.
- Composables et stores avec types de retour explicites ; `defineProps<…>()` et `defineEmits<…>()` en syntaxe générique.
- Accessibilité : labels, erreurs annoncées (`aria-describedby`, `role="alert"`), focus visible, parcours clavier.
- SEO : `useSeoMeta` sur chaque page, rendu SSR.
- Commentaires courts qui expliquent le **pourquoi**.

## Stores Pinia (séance 7 du cours)

- Setup syntax : state = `ref`, getters = `computed`, actions = fonctions ; types de retour explicites.
- Authentification dans les composants : **`useAuthStore()`** (`user`, `token`, `isAuthenticated`, `login()`, `logout()`). Il réutilise `useUserStore`, `useAuthCookies` et `useAuth().login` : ne pas recréer ces briques. Une seule déconnexion : `useAuthStore().logout()` (#34) ; le middleware lit `useAuthStore().isAuthenticated`.
- Déstructurer un store avec `storeToRefs(useXStore())`, jamais `const { x } = useXStore()` (perte de réactivité).
- Persistance : `pinia-plugin-persistedstate` (le paquet du cours, `@pinia-plugin-persistedstate/nuxt`, est abandonné). Stockage cookie par défaut (lu au rendu serveur). Toujours `persist: { pick: [...] }` avec le strict nécessaire ; **jamais** de jeton, mot de passe ou profil complet dans un store persisté.
- Les jetons restent dans `useAuthCookies` (durées différentes, ref partagée avec le refresh) ; le panier garde son cookie compact (tuples < 4 Ko).
- Un store se teste dans `tests/nuxt/` (`setActivePinia(createPinia())`, `mockNuxtImport` pour les requêtes et `navigateTo`). Détails : `docs/store-auth.md`.
- Séance de cours fournie par l'étudiant : lire la page, vérifier que les paquets cités sont maintenus (`npm view <paquet> deprecated`), adapter au projet ChampaShop et documenter la correspondance cours ↔ projet dans `docs/`.

## Avant de dire « fini »

- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:coverage`, `npm run build` : tout vert.
- Juger sur le **code de retour** (`npm run lint && npm run typecheck && …`), jamais sur un extrait de la sortie : un `| tail -1` a déjà masqué une erreur ESLint (`import/first`) qui n'a été vue qu'en CI.
- Tester dans le vrai site (`npm run dev`) ce qui peut l'être ; dire clairement ce qui n'a pas été testé.
- Une page ou un parcours ajouté ou modifié : ajouter ou adapter son parcours Playwright, puis `npm run test:e2e` (voir ci-dessous).

## Tests de bout en bout (Playwright)

Barème : « parcours complet vert en CI ». Le job « E2E Playwright » de la CI lance tous les fichiers de `e2e/` sur le build de production.

- Lancer en local : `npx playwright install chromium` (une seule fois), puis `npm run test:e2e`. Le build est refait automatiquement ; rapport HTML dans `playwright-report/` (`npx playwright show-report`).
- Un fichier par fonctionnalité : `e2e/<fonctionnalite>.spec.ts` (existants : `catalogue`, `connexion`, `filtres`, `compte`, `produit`, `accessibilite`).
- Trouver les éléments comme un utilisateur : `getByRole`, `getByLabel`, `getByText`, jamais par classe CSS. Un test qui ne trouve pas un bouton par son rôle signale souvent un problème d'accessibilité.
- `{ exact: true }` quand un nom en contient un autre (« Page 1 » / « Page 17 ») ; restreindre au `<main>` pour `role="alert"` (Nuxt en ajoute un pour annoncer les changements de page).
- Couvrir : le parcours normal, le clavier (`focus()` + `keyboard.press('Enter')`), le bouton retour (`page.goBack()`), une URL invalide, et le rendu sans JavaScript (`test.use({ javaScriptEnabled: false })`).
- Accessibilité : ajouter chaque nouvelle page au tableau `PAGES` de `e2e/accessibilite.spec.ts` (axe-core, WCAG 2.1 AA, zéro violation).
- Compte de démonstration pour les parcours connectés : `emilys` / `emilyspass` (public, donné par le sujet).

## Justification (chaque étudiant explique son code à l'oral)

- Écrire `docs/<sujet>.md` : chaque choix et sa raison, les alternatives rejetées, les cas limites, un exemple chiffré ou un schéma, la stratégie de tests. Lien depuis le README.
- Ajouter une ligne dans `docs/ai-usage/<prenom>.md` ; laisser la colonne « gardé / modifié / rejeté » à compléter par l'étudiant.

## Commentaires de review (à faire systématiquement)

- Avant de reprendre une issue, et quand l'étudiant signale une review : lire tous les commentaires de ses PR, y compris celles déjà mergées :
  ```bash
  gh api repos/Rteix05/WR505D/pulls/<n°>/reviews --jq '.[] | select(.body != "") | .body'
  gh api repos/Rteix05/WR505D/pulls/<n°>/comments --jq '.[] | "\(.path):\(.line) \(.body)"'
  gh api repos/Rteix05/WR505D/issues/<n°>/comments --jq '.[] | "\(.user.login): \(.body)"'
  ```
- Lister chaque point à l'étudiant avec une décision : à corriger, déjà traité, ou pas de changement (avec la raison).
- Corriger dans la branche de la PR si elle est ouverte, sinon dans une issue de suivi dédiée.
- Ajouter un test pour chaque correction de comportement, et noter « suite à la review de #<n°> » dans le `docs/<sujet>.md` concerné.
- Proposer une réponse point par point pour la PR ; ne la publier que si l'étudiant le demande.
- Si la review révèle une règle d'équipe, la reporter dans ce fichier.

## Pull Request (quand l'étudiant la demande)

- Vers `develop`, template rempli, `Closes #<n°>`, labels, milestone de la semaine en cours, assignée à l'étudiant.
- Ne cocher une case de la checklist que si c'est vraiment fait (ex. « Testé au clavier »).
- `develop` et `main` sont protégées : 1 approbation d'un coéquipier + CI verte, même pour les admins. Merge avec « Create a merge commit », branche supprimée après.

## Sécurité

Ne jamais coller de token, mot de passe ou fichier `.env` dans une conversation.

## Déjà dans le code : à réutiliser, pas à réécrire

Dans `develop` (issues #1, #2, #7, #10 et #12 mergées), sauf mention contraire.

| Élément                                                                                                             | Fichier                                                                                                 | Sert à                                                                                                           | Pour              |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| `computeCart(lines, promoCode?)`                                                                                    | `utils/promotions.ts`                                                                                   | Récapitulatif panier : brut, remises, livraison, total, `messages`                                               | #8, #9            |
| `CartLine`, `CartSummary`, `AppliedDiscount`                                                                        | `types/promotions.ts`                                                                                   | Types imposés par le sujet, montants en centimes                                                                 | #8, #9            |
| `toCents`, `formatCents`                                                                                            | `utils/price.ts`                                                                                        | Prix DummyJSON → centimes, affichage « 19,99 € »                                                                 | #2, #6, #9        |
| `useAuth()`                                                                                                         | `composables/useAuth.ts`                                                                                | `user`, `isLoggedIn`, `login()`, `loadUser()`                                                                    | #11               |
| `useAuthStore()`                                                                                                    | `stores/auth.ts`                                                                                        | **Point d'entrée auth** : `user`, `token`, `isAuthenticated`, `login()`, `logout()`, nom mémorisé (persisté)     | #11               |
| `useUserStore()`                                                                                                    | `stores/user.ts`                                                                                        | Utilisateur connecté, `setUser(null)` pour vider                                                                 | #11               |
| `useAuthCookies()`                                                                                                  | `composables/useAuthCookies.ts`                                                                         | Cookies des jetons, `clear()` pour la déconnexion                                                                | #11               |
| `safeRedirect()`                                                                                                    | `utils/auth.ts`                                                                                         | Valide `?redirect=` ; `/connexion` le gère déjà                                                                  | #11               |
| `$authFetch`                                                                                                        | `plugins/01.api.ts`                                                                                     | **Seulement** les routes qui exigent d'être connecté (sans jeton : `SessionExpiredError`) ; refresh auto sur 401 | #8 (paniers), #11 |
| `Product`, `ProductsResponse`, `Category`, `User`, `AuthTokens`…                                                    | `types/dummyjson.ts`                                                                                    | Toutes les réponses DummyJSON                                                                                    | #2, #6, #8        |
| `useApi()` : `getProducts`, `searchProducts`, `getProductsByCategory`, `getProduct`, `getCategories`                | `composables/useApi.ts`                                                                                 | Routes **publiques** (catalogue, fiche, catégories), `signal` pour annuler                                       | #2, #3, #5, #6    |
| `paginationItems`, `discountBadge`, `formatRating`                                                                  | `utils/pagination.ts`, `utils/product.ts`                                                               | Pages visibles, badge de remise et note                                                                          | #3, #5, #6        |
| `<ProductCard>`, `<ProductCardSkeleton>`, `<CatalogPagination>`                                                     | `components/`                                                                                           | Carte produit, squelette, pagination par liens (garde les autres query params)                                   | #3, #4, #5        |
| `debounce` (`cancel`, `flush`, `pending`), `needsLocalFiltering`, `filterLocally`, `localPage`                      | `utils/debounce.ts`, `utils/catalogSearch.ts` (branche `feature/3-recherche-debounce`)                  | Debounce testé ; filtrage et pagination locaux quand l'API ne sait pas combiner (recherche + catégorie)          | #5                |
| `<CatalogSearch>`                                                                                                   | `components/` (branche `feature/3-recherche-debounce`)                                                  | Champ de recherche debounce 300 ms, formulaire GET sans JavaScript                                               | —                 |
| `parsePriceInput`, `inPriceRange`, `hasPriceFilter`, `priceRangeLabel` ; `getAllProductSummaries`, `ProductSummary` | `utils/priceFilter.ts`, `utils/dummyjsonApi.ts`, `types/dummyjson.ts` (branche `feature/5-filtre-prix`) | Filtre prix en centimes ; tous les produits d'un périmètre en un appel (`limit=0` + `select`)                    | —                 |
| `parseCatalogQuery`, `toCatalogQuery`, `updateFilters`, `paginationParams`, `sortParams`                            | `utils/catalogQuery.ts`                                                                                 | Filtres du catalogue ↔ query params, validation, pagination                                                      | #2, #3, #5        |

Déconnexion (#11) : `useAuthStore().logout()` (cookies et utilisateur vidés, retour à l'accueil). Choix expliqués dans `docs/promotions.md`, `docs/authentification.md`, `docs/refresh-token.md`, `docs/catalogue-url.md` et `docs/store-auth.md`.

## Qui attend qui (semaine 2)

Semaine 1 : toutes les issues mergées, release v0.1.0 publiée (tag, GitHub Release, production à jour).

| Issue                                                | Responsable | Attend                         | Débloque   |
| ---------------------------------------------------- | ----------- | ------------------------------ | ---------- |
| #44 Logique pure du comparateur                      | Rafael      | rien                           | #46, #47   |
| #45 Client API : plusieurs produits par identifiants | Radouan     | rien                           | #47, #50   |
| #49 Logique pure des vus récemment                   | Marwan      | rien                           | #50        |
| #46 Sélection du comparateur (cookie, bouton, barre) | Marwan      | #44                            | #47        |
| #47 Page `/comparer` (URL source de vérité)          | Rafael      | #44, #45 ; #46 pour le cookie  | #48 (page) |
| #48 Tableau comparatif                               | Radouan     | rien (composant à props) ; #47 | —          |
| #50 Vus récemment (cookie, accueil, fiche)           | Marwan      | #45, #49                       | —          |
| #51 Release v0.2.0                                   | Radouan     | toutes les autres + hotfix     | —          |
| #52 Organisation de la semaine 2                     | Rafael      | rien                           | —          |
| Hotfix v0.1.1 (issue `bug-prod` de l'enseignant)     | à assigner  | —                              | #51        |

## Ordre de travail et coordination

1. En premier, en parallèle : #44 (Rafael), #45 (Radouan), #49 (Marwan) : les trois briques dont tout dépend.
2. Puis : #46 (Marwan) dès #44 ; #47 (Rafael) dès #44 et #45 ; #48 (Radouan) en composant à props dès le début, branché dans #47 ensuite ; #50 (Marwan) dès #45 et #49.
3. Hotfix : dès que l'issue `bug-prod` apparaît, il passe avant tout le reste (24 h).
4. Fin de semaine : #51, release v0.2.0 (Radouan), selon la procédure de release.

À caler ensemble :

- Nom des cookies imposés par le sujet : `compare` et `recently_viewed`, **identifiants uniquement**.
- **Une seule ref par cookie** : comme `useAuthCookies` (voir `docs/refresh-token.md`), lire et écrire chaque cookie via une seule instance (un store Pinia ou un composable mis en cache), sinon deux `useCookie('compare')` se désynchronisent.
- Valider tout cookie à la lecture (il vient du navigateur) : jamais d'erreur, valeur par défaut, réinitialisation (modèle : `parseCart` dans `utils/cart.ts`).
- Chargement de plusieurs produits : une seule méthode, `getProductsByIds` (#45), pour le comparateur, les vus récemment et le panier.
