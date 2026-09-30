# ChampaShop

Vitrine en ligne de la boutique fictive **ChampaShop** : projet fil rouge Nuxt 3 / Vue 3 / TypeScript.

- Dépôt : https://github.com/Rteix05/WR505D
- Site déployé : https://wr-505-d.vercel.app (Vercel, déployé automatiquement depuis `main`)
- API : [DummyJSON](https://dummyjson.com) (produits, authentification, paniers)

## Stack

Nuxt 3, Vue 3 `<script setup>`, TypeScript strict, Pinia, Vitest, ESLint, Prettier.

## Installation

Prérequis : Node.js 20 ou plus récent (la CI utilise Node 22), npm.

```bash
git clone https://github.com/Rteix05/WR505D.git
cd WR505D
npm install
npm run dev
```

Le site est alors disponible sur http://localhost:3000.

## Scripts

| Script                  | Rôle                                                      |
| ----------------------- | --------------------------------------------------------- |
| `npm run dev`           | Serveur de développement                                  |
| `npm run build`         | Build de production                                       |
| `npm run preview`       | Prévisualise le build de production                       |
| `npm run lint`          | ESLint (règle `no-explicit-any` en erreur)                |
| `npm run lint:fix`      | ESLint avec correction automatique                        |
| `npm run format`        | Formate le code avec Prettier                             |
| `npm run format:check`  | Vérifie le formatage (utilisé par la CI)                  |
| `npm run typecheck`     | Vérification TypeScript (`nuxt typecheck`)                |
| `npm run test`          | Tests Vitest                                              |
| `npm run test:coverage` | Tests + couverture (seuil 90 % sur `utils/promotions.ts`) |

La CI (`.github/workflows/ci.yml`) exécute sur chaque PR : install, lint, format, typecheck, tests avec couverture, build.

## Déploiement

Le site est hébergé sur Vercel :

- chaque merge dans `main` déclenche un déploiement de production ;
- chaque PR obtient un déploiement de prévisualisation, pratique pour les reviews ;
- l'URL publique du site (`runtimeConfig.public.siteUrl`, utilisée pour l'Open Graph) est déduite de la variable système Vercel `VERCEL_PROJECT_PRODUCTION_URL`, aucune configuration manuelle n'est nécessaire.

## Architecture

```
pages/          routes (catalogue, fiche produit, panier, connexion, compte)
layouts/        gabarits de page
components/     composants d'affichage (props et emits typés)
composables/    logique réutilisable liée à Vue (fetch, debounce, auth)
stores/         stores Pinia (panier, utilisateur)
utils/          fonctions pures TypeScript, sans Vue ni Pinia (promotions, filtres, prix)
types/          types partagés, dont les réponses DummyJSON (types/dummyjson.ts)
middleware/     middleware de route (auth)
plugins/        plugins Nuxt (client API authentifié, chargement de l'utilisateur côté serveur)
tests/unit/     tests Vitest des fonctions pures
docs/ai-usage/  journal d'usage de l'IA, un fichier par étudiant
```

### Principes SOLID appliqués

- **Responsabilité unique** : la logique métier (promotions, filtres, prix) vit dans `utils/` en fonctions pures ; les composants ne font que de l'affichage ; les stores orchestrent l'état.
- **Ouvert / fermé** : les règles de promotion sont des fonctions indépendantes appliquées dans l'ordre ; ajouter une règle ne modifie pas les autres.
- **Substitution de Liskov** : les composants partagent des contrats de props typés, un composant peut en remplacer un autre qui respecte le même contrat.
- **Ségrégation des interfaces** : des types ciblés (`CartLine`, `CartSummary`…) plutôt qu'un gros objet produit transmis partout ; le cookie panier ne stocke que le strict nécessaire.
- **Inversion des dépendances** : les composants dépendent de composables (`useProducts`, `useAuth`…) et non directement de `$fetch` ; l'URL de l'API vient de `runtimeConfig`.

### Référencement

- `lang="fr"`, titre et description par défaut dans `nuxt.config.ts`, `titleTemplate`.
- `useSeoMeta` sur chaque page (titre, description, Open Graph).
- Rendu serveur (SSR) : le contenu est présent dans le HTML initial.
- `public/robots.txt` exclut les pages privées (`/compte`, `/panier`, `/connexion`).

### Types et client API

Réponses DummyJSON typées dans `types/dummyjson.ts` à partir des réponses réelles. Routes publiques via `useApi()`, routes authentifiées via `$authFetch`, URL de base dans `runtimeConfig.public.apiBase`. Choix détaillés dans [docs/client-api.md](docs/client-api.md).

### Catalogue

`/produits` : 12 produits par page, page courante dans l'URL (`?page=`), rendu serveur (fonctionne sans JavaScript), squelettes, erreur avec « Réessayer ». Choix détaillés dans [docs/catalogue.md](docs/catalogue.md).

### Moteur de promotions

Fonction pure `computeCart` dans `utils/promotions.ts`, montants en centimes entiers. Choix techniques détaillés (arrondi, ordre des règles, plafond, cas limites) dans [docs/promotions.md](docs/promotions.md).

### Authentification

Connexion DummyJSON, jetons en cookies, utilisateur chargé côté serveur (pas de flash de l'état déconnecté). Choix techniques (cookies, profil réduit, redirection sûre, accessibilité) dans [docs/authentification.md](docs/authentification.md).

Les appels authentifiés passent par `$authFetch` : sur une 401, le jeton est rafraîchi une seule fois (single-flight) même si plusieurs requêtes échouent en même temps, puis elles sont rejouées. Détails dans [docs/refresh-token.md](docs/refresh-token.md).

`/compte` est protégée par le middleware `auth` : un visiteur déconnecté est redirigé vers `/connexion?redirect=…`, puis ramené sur la page demandée après connexion. « Se déconnecter » supprime les cookies et l'utilisateur du store, puis renvoie à l'accueil. Détails dans [docs/pages-privees.md](docs/pages-privees.md).

Pour tester l'expiration du jeton : `NUXT_PUBLIC_AUTH_EXPIRES_IN_MINS=1 npm run dev`.

### Filtre prix min / max

_À compléter dans l'issue dédiée : stratégie retenue, nombre d'appels, performance, impact sur la pagination._

## Conventions Git (GitFlow)

| Branche               | Créée depuis | Mergée dans        | Règle                                                          |
| --------------------- | ------------ | ------------------ | -------------------------------------------------------------- |
| `main`                | —            | —                  | Production. Merge uniquement depuis `release/*` ou `hotfix/*`  |
| `develop`             | `main`       | —                  | Intégration. Merge uniquement par PR approuvée                 |
| `feature/<n°>-<desc>` | `develop`    | `develop`          | Une issue = une branche = une PR. Ex. `feature/14-filtres-url` |
| `release/vX.Y.Z`      | `develop`    | `main` + `develop` | Gel des fonctionnalités, version, CHANGELOG, tag annoté        |
| `hotfix/<desc>`       | `main`       | `main` + `develop` | Correction urgente, incrémente le patch                        |

Règles :

1. Chaque fonctionnalité a une issue GitHub assignée à **un seul** membre, avec des critères d'acceptation.
2. Commits au format [Conventional Commits](https://www.conventionalcommits.org/fr/) : `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
3. La PR vers `develop` référence l'issue (`Closes #14`), remplit le template et passe la CI.
4. Au moins une review approuvée d'un coéquipier, avec des commentaires argumentés.
5. Merge avec « Create a merge commit » (équivalent `--no-ff`), branche supprimée après merge.
6. `main` et `develop` sont protégées : PR obligatoire, 1 approbation, CI verte, pas de force-push.

Démarrer une fonctionnalité :

```bash
git switch develop
git pull
git switch -c feature/14-filtres-url
# ... commits ...
git push -u origin feature/14-filtres-url
# puis ouvrir la PR vers develop sur GitHub
```

## Répartition des rôles

| Membre  | Rôle                                   | Issues (semaine 1)                                                                                                                                        |
| ------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rafael  | Mise en place, logique métier et auth  | #13 finalisation du setup, #4 filtres et URL source de vérité, #7 moteur de promotions, #10 connexion et utilisateur SSR, #12 refresh token single-flight |
| Radouan | Catalogue                              | #1 types DummyJSON et client API, #2 catalogue paginé, #3 recherche avec debounce, #5 filtre prix min / max                                               |
| Marwan  | Fiche produit, panier et pages privées | #6 fiche produit, #8 store panier et cookie, #9 page panier et code promo, #11 middleware auth, compte et déconnexion                                     |

Ordre conseillé : #1 (types) en premier car tout le reste en dépend, puis #7 (promotions) avant #8 et #9 (le panier appelle `computeCart`), et #10 avant #11 et #12.

## Usage de l'IA

Chaque membre tient `docs/ai-usage/<prenom>.md` à jour (modèle : `docs/ai-usage/_modele.md`).
