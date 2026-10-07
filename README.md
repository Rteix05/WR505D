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

| Script                  | Rôle                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `npm run dev`           | Serveur de développement                                                                 |
| `npm run build`         | Build de production                                                                      |
| `npm run preview`       | Prévisualise le build de production                                                      |
| `npm run lint`          | ESLint (règle `no-explicit-any` en erreur)                                               |
| `npm run lint:fix`      | ESLint avec correction automatique                                                       |
| `npm run format`        | Formate le code avec Prettier                                                            |
| `npm run format:check`  | Vérifie le formatage (utilisé par la CI)                                                 |
| `npm run typecheck`     | Vérification TypeScript (`nuxt typecheck`)                                               |
| `npm run test`          | Tests Vitest                                                                             |
| `npm run test:coverage` | Tests + couverture (seuil 90 % sur `utils/promotions.ts`)                                |
| `npm run test:e2e`      | Parcours Playwright sur le build de production (catalogue, connexion, accessibilité axe) |

La CI (`.github/workflows/ci.yml`) exécute sur chaque PR : install, lint, format, typecheck, tests avec couverture, build, puis un second job lance les parcours Playwright (rapport HTML en artefact).

Première utilisation de Playwright en local : `npx playwright install chromium`.

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
stores/         stores Pinia (auth, utilisateur, panier) ; persistance pinia-plugin-persistedstate
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

### Recherche

Champ de recherche sur `/produits` (`/products/search`) : debounce de 300 ms, requête précédente annulée (une réponse ancienne n'écrase jamais la plus récente), `?q=` dans l'URL avec retour à la page 1, fonctionne sans JavaScript. Recherche + catégorie filtrée localement (l'API ne sait pas les combiner). Détails dans [docs/recherche.md](docs/recherche.md).

### Store d'authentification (séance 7)

`useAuthStore` (setup store : state, getters, actions) regroupe l'authentification pour les composants ; le nom de la dernière connexion est persisté en cookie par `pinia-plugin-persistedstate` et pré-remplit `/connexion` dès le rendu serveur. Détails dans [docs/store-auth.md](docs/store-auth.md).

### Moteur de promotions

Fonction pure `computeCart` dans `utils/promotions.ts`, montants en centimes entiers. Choix techniques détaillés (arrondi, ordre des règles, plafond, cas limites) dans [docs/promotions.md](docs/promotions.md).

### Authentification

Connexion DummyJSON, jetons en cookies, utilisateur chargé côté serveur (pas de flash de l'état déconnecté). Choix techniques (cookies, profil réduit, redirection sûre, accessibilité) dans [docs/authentification.md](docs/authentification.md).

Les appels authentifiés passent par `$authFetch` : sur une 401, le jeton est rafraîchi une seule fois (single-flight) même si plusieurs requêtes échouent en même temps, puis elles sont rejouées. Détails dans [docs/refresh-token.md](docs/refresh-token.md).

`/compte` est protégée par le middleware `auth` : un visiteur déconnecté est redirigé vers `/connexion?redirect=…`, puis ramené sur la page demandée après connexion. « Se déconnecter » supprime les cookies et l'utilisateur du store, puis renvoie à l'accueil. Détails dans [docs/pages-privees.md](docs/pages-privees.md).

Pour tester l'expiration du jeton : `NUXT_PUBLIC_AUTH_EXPIRES_IN_MINS=1 npm run dev`.

### URL du catalogue

Page, recherche, catégorie, tri et prix sont dans les query params, lus et écrits par les fonctions pures de `utils/catalogQuery.ts`. Noms des paramètres et règles de validation dans [docs/catalogue-url.md](docs/catalogue-url.md).

### Fiche produit

`/produits/[id]` : galerie, marque, note, prix, stock (« Plus que X en stock » sous 5, bouton désactivé en rupture), garantie et livraison, ajout au panier. Vraie 404 (statut HTTP compris) pour un identifiant inexistant ou invalide, page d'erreur en français (`error.vue`). Choix détaillés dans [docs/fiche-produit.md](docs/fiche-produit.md).

### Produits vus récemment

Logique pure dans `utils/recentlyViewed.ts` : `pushRecentlyViewed` (produit visité en tête, sans doublon, 10 maximum) et `parseRecentlyViewedCookie` (cookie `recently_viewed` validé, ne lève jamais d'erreur). Choix et cas limites dans [docs/vus-recemment.md](docs/vus-recemment.md).

### Comparateur : sélection

Bouton « Comparer » (bascule `aria-pressed`) sur chaque carte et sur la fiche produit, 3 produits maximum, barre « Comparer (2/3) » visible pendant la navigation, sélection dans le cookie `compare` (identifiants uniquement, lu dès le rendu serveur, validé à la lecture). Choix détaillés dans [docs/comparateur-selection.md](docs/comparateur-selection.md).

### Panier

Store Pinia `cart` persisté dans un cookie (présent dès le rendu serveur, moins de 4 Ko), limite de stock expliquée à l'utilisateur, récapitulatif calculé par `computeCart`. Choix techniques (format du cookie, validation, stock) dans [docs/panier.md](docs/panier.md).

### Filtre prix min / max

DummyJSON n'a aucun paramètre de prix, et filtrer la page de 12 produits reçue donnerait des pages vides et un total faux. Stratégie retenue :

- **Nombre d'appels** : un seul par affichage. Tous les produits concernés (catalogue, catégorie ou recherche) sont demandés en une fois (`limit=0`), réduits aux 7 champs d'une carte (`select`).
- **Performance** : 6,8 Ko compressés pour les 194 produits, soit moins de deux fois une page normale (3,9 Ko). Sans `select`, ce serait 47,5 Ko. Le tri reste fait par l'API.
- **Pagination** : filtrage puis découpage en pages de 12 dans l'application (`filterLocally`, `localPage`). Le total est exact (« 31 produits, page 1 sur 3 »), les liens de pagination ne changent pas.
- **Seulement si besoin** : sans prix, le catalogue reste paginé par l'API. Le même chemin sert à la recherche + catégorie (#3), que l'API ne sait pas combiner.
- Prix comparés en centimes, bornes incluses, sur le prix affiché.

Alternatives écartées (enchaîner les pages de l'API, route serveur avec cache) et mesures dans [docs/filtre-prix.md](docs/filtre-prix.md).

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

### Semaine 2 : comparateur, produits vus récemment, hotfix (milestone « Semaine 2 »)

| Membre  | Issues (semaine 2)                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------- |
| Rafael  | #44 logique pure du comparateur, #47 page `/comparer` (URL source de vérité), #52 organisation de la semaine          |
| Radouan | #45 client API (plusieurs produits par identifiants), #48 tableau comparatif accessible et mobile, #51 release v0.2.0 |
| Marwan  | #46 sélection du comparateur (cookie, bouton, barre), #49 logique pure des vus récemment, #50 produits vus récemment  |

Ordre conseillé : #44, #45 et #49 d'abord (les briques dont tout dépend), puis #46, #47, #48 et #50. Le hotfix imposé (issue `bug-prod` ouverte par l'enseignant) est assigné à un membre et relu par un autre dès son apparition, et passe avant tout le reste (24 h ouvrées).

## Usage de l'IA

Chaque membre tient `docs/ai-usage/<prenom>.md` à jour (modèle : `docs/ai-usage/_modele.md`).
