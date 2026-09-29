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
- label `feature`, milestone « Semaine 1 », s'assigner la PR ;
- demander une review à un coéquipier.

Il faut la CI verte et 1 approbation : on ne peut pas merger sa propre PR sans.

### 5. Corriger après une review

Rester sur sa branche, modifier, puis :

```bash
git add .
git commit -m "fix: <ce qui a été corrigé>"
git push              # la PR se met à jour toute seule
```

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

## Avant de dire « fini »

- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:coverage`, `npm run build` : tout vert.
- Tester dans le vrai site (`npm run dev`) ce qui peut l'être ; dire clairement ce qui n'a pas été testé.

## Justification (chaque étudiant explique son code à l'oral)

- Écrire `docs/<sujet>.md` : chaque choix et sa raison, les alternatives rejetées, les cas limites, un exemple chiffré ou un schéma, la stratégie de tests. Lien depuis le README.
- Ajouter une ligne dans `docs/ai-usage/<prenom>.md` ; laisser la colonne « gardé / modifié / rejeté » à compléter par l'étudiant.

## Pull Request (quand l'étudiant la demande)

- Vers `develop`, template rempli, `Closes #<n°>`, labels, milestone « Semaine 1 », assignée à l'étudiant.
- Ne cocher une case de la checklist que si c'est vraiment fait (ex. « Testé au clavier »).
- `develop` et `main` sont protégées : 1 approbation d'un coéquipier + CI verte, même pour les admins. Merge avec « Create a merge commit », branche supprimée après.

## Sécurité

Ne jamais coller de token, mot de passe ou fichier `.env` dans une conversation.

## Déjà dans le code : à réutiliser, pas à réécrire

Dans `develop` depuis le merge des PR #15 (#7), #16 (#10) et #17 (#12), sauf mention contraire.

| Élément                                                                                  | Fichier                                                   | Sert à                                                             | Pour             |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ | ---------------- |
| `computeCart(lines, promoCode?)`                                                         | `utils/promotions.ts`                                     | Récapitulatif panier : brut, remises, livraison, total, `messages` | #8, #9           |
| `CartLine`, `CartSummary`, `AppliedDiscount`                                             | `types/promotions.ts`                                     | Types imposés par le sujet, montants en centimes                   | #8, #9           |
| `toCents`, `formatCents`                                                                 | `utils/price.ts`                                          | Prix DummyJSON → centimes, affichage « 19,99 € »                   | #2, #6, #9       |
| `useAuth()`                                                                              | `composables/useAuth.ts`                                  | `user`, `isLoggedIn`, `login()`, `loadUser()`                      | #11              |
| `useUserStore()`                                                                         | `stores/user.ts`                                          | Utilisateur connecté, `setUser(null)` pour vider                   | #11              |
| `useAuthCookies()`                                                                       | `composables/useAuthCookies.ts`                           | Cookies des jetons, `clear()` pour la déconnexion                  | #11              |
| `safeRedirect()`                                                                         | `utils/auth.ts`                                           | Valide `?redirect=` ; `/connexion` le gère déjà                    | #11              |
| `$authFetch`                                                                             | `plugins/01.api.ts`                                       | Appels avec jeton, refresh automatique sur 401                     | #1, #11          |
| `User`, `AuthTokens` provisoires                                                         | `types/auth.ts`                                           | Réponses d'authentification                                        | #1 (à fusionner) |
| `parseCatalogQuery`, `toCatalogQuery`, `updateFilters`, `paginationParams`, `sortParams` | `utils/catalogQuery.ts` (branche `feature/4-filtres-url`) | Filtres du catalogue ↔ query params, validation, pagination        | #2, #3, #5       |

Déconnexion (#11) : `useAuthCookies().clear()`, `useUserStore().setUser(null)`, puis `navigateTo('/')`. Choix expliqués dans `docs/promotions.md`, `docs/authentification.md` et `docs/refresh-token.md`.

## Qui attend qui

| Issue                     | Responsable | Attend                                | Débloque         |
| ------------------------- | ----------- | ------------------------------------- | ---------------- |
| #1 Types + client API     | Radouan     | rien (réutiliser `$authFetch` de #12) | #2, #4, #6       |
| #2 Catalogue `/produits`  | Radouan     | #1                                    | #3, #4, #5       |
| #3 Recherche debounce     | Radouan     | #2 ; param `q` commun avec #4         | —                |
| #5 Filtre prix            | Radouan     | #2 ; params prix communs avec #4      | —                |
| #7 Promotions             | Rafael      | mergée                                | #8, #9           |
| #10 Connexion             | Rafael      | mergée                                | #11, #12         |
| #12 Refresh token         | Rafael      | mergée                                | client API de #1 |
| #4 Filtres, tri, URL      | Rafael      | #1, #2 (partie pure faite)            | —                |
| #6 Fiche produit          | Marwan      | #1 ; bouton « Ajouter » via #8        | —                |
| #8 Store panier           | Marwan      | #7                                    | #6 (bouton), #9  |
| #9 Page panier            | Marwan      | #7, #8                                | —                |
| #11 Middleware, `/compte` | Marwan      | #10                                   | —                |

## Ordre de travail et coordination

1. Radouan : #1 (fusionner `types/auth.ts` dans `types/dummyjson.ts`, brancher les appels authentifiés sur `$authFetch`), puis #2, puis #3 et #5.
2. Marwan : #8 puis #9, et #11 (débloquées) ; #6 après #1.
3. Rafael : relire les PR de l'équipe ; page de #4 après #1 et #2.
4. Fin de semaine : `release/v0.1.0`, merge dans `main` et `develop`, tag `v0.1.0` et GitHub Release.

À caler ensemble :

- Noms des query params du catalogue (proposition : `page`, `q`, `category`, `sortBy`, `order`, `minPrice`, `maxPrice`), communs à #3, #4 et #5.
- Un seul client API : #1 s'appuie sur `$authFetch` et `runtimeConfig.public.apiBase`.
- Cookie panier (#8) : seulement `productId`, `quantity` et le nécessaire pour `CartLine`, sous 4 Ko.
- Prix toujours convertis avec `toCents` avant `computeCart`.
