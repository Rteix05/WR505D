# Pages privées : middleware, `/compte` et déconnexion

Issue #11. Fichiers : `middleware/auth.ts`, `pages/compte.vue`, `composables/useAuth.ts` (`logout`), `utils/auth.ts` (`loginRedirectLocation`), `layouts/default.vue`, `tests/unit/auth.spec.ts`.

S'appuie sur la connexion (#10, [docs/authentification.md](authentification.md)) et le refresh du jeton (#12, [docs/refresh-token.md](refresh-token.md)).

## 1. Le parcours

```
Visiteur déconnecté → /compte?onglet=commandes
   │  middleware auth : store vide
   ▼
302 → /connexion?redirect=/compte?onglet=commandes
   │  connexion réussie, safeRedirect(redirect) accepte la cible
   ▼
/compte?onglet=commandes            (même page, même query)
   │  « Se déconnecter »
   ▼
cookies supprimés, store vidé → / (replace)
```

## 2. Middleware `auth` nommé, pas global

`middleware/auth.ts` est un middleware **nommé** : chaque page privée l'active avec `definePageMeta({ middleware: 'auth' })`.

- **Pourquoi pas un middleware global avec une liste de chemins privés** : il faudrait tenir la liste à jour à part. Avec le middleware nommé, la protection est écrite dans la page elle-même : en lisant `compte.vue`, on voit tout de suite qu'elle est privée.
- **Une seule condition, `useUserStore().isLoggedIn`** : le middleware ne lit pas les cookies et n'appelle pas l'API. C'est le plugin `02.auth.server.ts` qui charge l'utilisateur, **avant** les middlewares de route, et qui rafraîchit le jeton si besoin (#12). Le middleware réutilise donc ce résultat, sans rien recalculer.
- **Côté serveur**, un visiteur déconnecté reçoit une vraie redirection **302** : le HTML de la page privée n'est jamais rendu, et cela fonctionne même sans JavaScript.
- **Côté client**, le store est transmis avec le HTML (état Pinia hydraté) : une navigation vers `/compte` est vérifiée sans appel réseau.

Cas limite : un jeton invalide ou expiré sans refresh possible. `loadUser()` vide alors le store, et le middleware redirige vers la connexion comme pour un visiteur sans cookie (testé à la main, voir section 6).

## 3. Revenir à la page demandée : `?redirect=`

`loginRedirectLocation(to.fullPath)` renvoie `{ path: '/connexion', query: { redirect: to.fullPath } }`.

- **`to.fullPath` et pas `to.path`** : on garde la query et le hash. `/compte?onglet=commandes` revient sur le bon onglet, pas seulement sur `/compte`.
- **Un objet et pas une chaîne construite à la main** : vue-router encode lui-même la valeur. Avec `` `/connexion?redirect=${to.fullPath}` ``, la cible `/compte?a=1&b=2` serait coupée au `&` et le paramètre `b` deviendrait un paramètre de `/connexion`. Vérifié : la redirection produite est `/connexion?redirect=/compte?a=1%26b=2`.
- **Pas de nouvelle validation** : la page `/connexion` (#10) passe déjà `?redirect=` dans `safeRedirect()`, qui refuse les redirections vers un autre site (open redirect). Un test vérifie que **tout ce que le middleware envoie est accepté tel quel par `safeRedirect`**, sinon l'utilisateur atterrirait sur l'accueil après s'être connecté.
- Déjà connecté sur `/connexion?redirect=…` : la page redirige directement vers la cible (déjà géré par #10).

## 4. Déconnexion : `logout()` dans `useAuth()`

```ts
cookies.clear() // accessToken et refreshToken mis à null → cookies supprimés
store.setUser(null) // l'en-tête repasse à « Connexion »
await navigateTo('/', { replace: true })
```

- **Dans `useAuth()`** et pas dans la page : c'est l'inverse de `login()`, et l'en-tête ou une autre page pourront l'appeler.
- **Les deux sont vidés** : les cookies seuls ne suffisent pas (le store garderait l'utilisateur affiché jusqu'au prochain rechargement), le store seul non plus (au prochain rendu serveur, le plugin rechargerait l'utilisateur depuis les cookies).
- **`useAuthCookies()` et pas un nouveau `useCookie`** : une seule instance par application (voir le commentaire de `useAuthCookies.ts`). Un second `useCookie('accessToken')` serait une autre ref, et le vrai jeton pourrait être réécrit après la déconnexion.
- **`replace: true`** : après la déconnexion, « Précédent » ne ramène pas sur `/compte`. Sinon, le middleware renverrait vers la connexion, ce qui serait déroutant.
- **Pas d'appel API** : DummyJSON n'a pas de route pour révoquer un jeton. Supprimer les cookies suffit pour qu'aucun appel authentifié ne soit plus possible depuis ce navigateur. Limite connue : un jeton copié ailleurs reste valable jusqu'à son expiration. Un vrai backend exposerait une route `POST /auth/logout`.
- **Le panier n'est pas vidé** : il n'est pas lié au compte (cookie `cart` à part), comme sur la plupart des boutiques.

## 5. Page `/compte`

- Affiche nom, nom d'utilisateur, e-mail et avatar, **depuis le store**. Ces données sont déjà chargées côté serveur par le plugin : pas de second appel `/auth/me`. Le store ne contient que le profil réduit (`toAuthUser`), sans données sensibles, car il est sérialisé dans le HTML.
- `useSeoMeta` avec `robots: 'noindex, nofollow'`, et `/compte` est déjà exclu dans `public/robots.txt`.
- Accessibilité : `<h1>` relié à la section (`aria-labelledby`), informations en `<dl>` (chaque valeur est lue avec son intitulé), avatar en `alt=""` (décoratif, le nom est écrit à côté), vrai `<button>` pour la déconnexion, focus visible.
- `v-if="user"` : pendant la déconnexion, le store est vidé juste avant la navigation. La page n'essaie donc pas d'afficher un utilisateur `null`.
- En-tête : un lien **« Mon compte »** vers `/compte` est ajouté **à côté** de « Bonjour, Emily ». Suite à la review de #31 (Rafael) : la première version remplaçait le prénom par le lien, ce qui cassait le test anti-flash de `e2e/connexion.spec.ts`. Ce test a besoin d'une donnée propre à l'utilisateur dans le HTML du serveur : un texte fixe comme « Mon compte » ne prouve pas que c'est **cet** utilisateur qui a été chargé côté serveur. On garde donc le prénom, et le test vérifie aussi le lien.

## 6. Tests

Automatiques, `tests/unit/auth.spec.ts` :

- `loginRedirectLocation` renvoie la bonne destination ;
- aller-retour middleware → `/connexion` : `/compte`, `/compte?onglet=commandes` et `/compte?a=1&b=2#adresse` sont acceptés tels quels par `safeRedirect`.

Le middleware, `logout()` et la page ne sont pas testés automatiquement (il faudrait l'environnement Nuxt, le middleware n'a qu'une condition). Testé à la main sur le build de production (`curl`) :

| Requête                                               | Résultat                                        |
| ----------------------------------------------------- | ----------------------------------------------- |
| `/compte?onglet=x` sans cookie                        | 302 → `/connexion?redirect=/compte?onglet=x`    |
| `/compte?a=1&b=2` sans cookie                         | 302 → `/connexion?redirect=/compte?a=1%26b=2`   |
| `/compte` avec un jeton valide (emilys)               | 200, nom, e-mail, « Se déconnecter », `noindex` |
| `/compte` avec un jeton invalide                      | 302 → `/connexion?redirect=/compte`             |
| `/connexion?redirect=/compte?a=1%26b=2` déjà connecté | 302 → `/compte?a=1&b=2`                         |

De bout en bout, `e2e/compte.spec.ts` (Playwright, Chromium, build de production), ajouté suite à la review de #31 :

- `/compte?onglet=commandes` déconnecté → `/connexion?redirect=…` (valeur décodée vérifiée, query comprise), puis retour sur `/compte?onglet=commandes` après connexion ;
- lien « Mon compte » de l'en-tête ;
- déconnexion à la souris : accueil, lien « Connexion » revenu, cookies `accessToken` et `refreshToken` supprimés, « Précédent » ramène à la connexion et pas au compte, `/compte` de nouveau protégé ;
- déconnexion au clavier (Entrée sur « Se déconnecter ») ;
- axe-core sur `/compte` connecté (pas dans `accessibilite.spec.ts` : sans session, axe analyserait la page de connexion après la redirection) ;
- sans JavaScript : redirection 302 du serveur, la page privée n'est jamais rendue.
