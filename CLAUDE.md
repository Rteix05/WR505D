# ChampaShop : consignes communes pour l'IA

Projet fil rouge Nuxt 3, Vue 3, TypeScript strict, Pinia, Vitest. Dépôt `Rteix05/WR505D`, équipe de trois : Rafael (`Rteix05`), Radouan (`rdn244`), Marwan (`Marwan550-mmi`).

Ce fichier est lu automatiquement par Claude Code. Avec un autre outil (ChatGPT, Copilot…), copier-coller son contenu en début de conversation.

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

Arrive dans `develop` au merge des PR #15 (#7), #16 (#10) et #17 (#12).

| Élément                                      | Fichier                         | Sert à                                                             | Pour             |
| -------------------------------------------- | ------------------------------- | ------------------------------------------------------------------ | ---------------- |
| `computeCart(lines, promoCode?)`             | `utils/promotions.ts`           | Récapitulatif panier : brut, remises, livraison, total, `messages` | #8, #9           |
| `CartLine`, `CartSummary`, `AppliedDiscount` | `types/promotions.ts`           | Types imposés par le sujet, montants en centimes                   | #8, #9           |
| `toCents`, `formatCents`                     | `utils/price.ts`                | Prix DummyJSON → centimes, affichage « 19,99 € »                   | #2, #6, #9       |
| `useAuth()`                                  | `composables/useAuth.ts`        | `user`, `isLoggedIn`, `login()`, `loadUser()`                      | #11              |
| `useUserStore()`                             | `stores/user.ts`                | Utilisateur connecté, `setUser(null)` pour vider                   | #11              |
| `useAuthCookies()`                           | `composables/useAuthCookies.ts` | Cookies des jetons, `clear()` pour la déconnexion                  | #11              |
| `safeRedirect()`                             | `utils/auth.ts`                 | Valide `?redirect=` ; `/connexion` le gère déjà                    | #11              |
| `$authFetch`                                 | `plugins/01.api.ts`             | Appels avec jeton, refresh automatique sur 401                     | #1, #11          |
| `User`, `AuthTokens` provisoires             | `types/auth.ts`                 | Réponses d'authentification                                        | #1 (à fusionner) |

Déconnexion (#11) : `useAuthCookies().clear()`, `useUserStore().setUser(null)`, puis `navigateTo('/')`. Choix expliqués dans `docs/promotions.md`, `docs/authentification.md` et `docs/refresh-token.md`.

## Qui attend qui

| Issue                     | Responsable | Attend                                | Débloque         |
| ------------------------- | ----------- | ------------------------------------- | ---------------- |
| #1 Types + client API     | Radouan     | rien (réutiliser `$authFetch` de #12) | #2, #4, #6       |
| #2 Catalogue `/produits`  | Radouan     | #1                                    | #3, #4, #5       |
| #3 Recherche debounce     | Radouan     | #2 ; param `q` commun avec #4         | —                |
| #5 Filtre prix            | Radouan     | #2 ; params prix communs avec #4      | —                |
| #7 Promotions             | Rafael      | rien (PR #15)                         | #8, #9           |
| #10 Connexion             | Rafael      | rien (PR #16)                         | #11, #12         |
| #12 Refresh token         | Rafael      | #10 (PR #17)                          | client API de #1 |
| #4 Filtres, tri, URL      | Rafael      | #1, #2 ; params de #3 et #5           | —                |
| #6 Fiche produit          | Marwan      | #1 ; bouton « Ajouter » via #8        | —                |
| #8 Store panier           | Marwan      | #7                                    | #6 (bouton), #9  |
| #9 Page panier            | Marwan      | #7, #8                                | —                |
| #11 Middleware, `/compte` | Marwan      | #10                                   | —                |

## Ordre de travail et coordination

1. Radouan : #1 (fusionner `types/auth.ts` dans `types/dummyjson.ts`, brancher les appels authentifiés sur `$authFetch`), puis #2, puis #3 et #5.
2. Marwan : relire #15 et #16, puis #8 et #9 dès le merge de #15 ; #6 après #1 ; #11 après #16.
3. Rafael : relire les PR de l'équipe, #17 après le merge de #16, puis #4 après #1 et #2.
4. Fin de semaine : `release/v0.1.0`, merge dans `main` et `develop`, tag `v0.1.0` et GitHub Release.

À caler ensemble :

- Noms des query params du catalogue (proposition : `page`, `q`, `category`, `sortBy`, `order`, `minPrice`, `maxPrice`), communs à #3, #4 et #5.
- Un seul client API : #1 s'appuie sur `$authFetch` et `runtimeConfig.public.apiBase`.
- Cookie panier (#8) : seulement `productId`, `quantity` et le nécessaire pour `CartLine`, sous 4 Ko.
- Prix toujours convertis avec `toCents` avant `computeCart`.
