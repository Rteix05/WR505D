# Store d'authentification et persistance (séance 7) : choix techniques

Issue #32. Fichiers : `stores/auth.ts`, `nuxt.config.ts` (module `pinia-plugin-persistedstate/nuxt`), `pages/connexion.vue`, `layouts/default.vue`, `tests/nuxt/authStore.spec.ts`, `e2e/connexion.spec.ts`.

## 1. Ce que demande la séance

La séance 7 (« State avancé avec Pinia ») demande, pour son projet DevFlow :

| Demande du cours                                 | Dans ChampaShop                                              |
| ------------------------------------------------ | ------------------------------------------------------------ |
| Stores en setup syntax : state, getters, actions | `stores/auth.ts`, `stores/user.ts`, `stores/cart.ts`         |
| `authStore` : `user`, `token`, `isAuthenticated` | `useAuthStore` : getters `user`, `token`, `isAuthenticated`  |
| Actions `login()`, `logout()`                    | `useAuthStore().login()`, `useAuthStore().logout()`          |
| Persistance `persist: true`                      | `persist: { pick: ['rememberedUsername'] }`, stockage cookie |
| Composants raccordés aux stores                  | En-tête (`storeToRefs`) et page `/connexion`                 |

## 2. Le paquet du cours est abandonné

Le cours cite `@pinia-plugin-persistedstate/nuxt`. Sur npm, ce paquet est marqué **deprecated** et n'accepte que `@pinia/nuxt` 0.5 ; le projet utilise `@pinia/nuxt` 1 et Pinia 4. Le plugin a été regroupé dans le paquet principal **`pinia-plugin-persistedstate`** (v4), dont le module Nuxt s'importe avec `pinia-plugin-persistedstate/nuxt`. Même plugin, même option `persist`, mais maintenu et compatible.

## 3. Un ajout, pas un remplacement

Avant cette séance, l'authentification existait déjà, répartie en briques testées :

- `useUserStore` : l'utilisateur, chargé côté serveur avant le rendu (#10) ;
- `useAuthCookies` : les jetons, une seule ref par cookie, partagée avec le refresh single-flight (#12) ;
- `useAuth().login` : la requête `POST /auth/login`.

`useAuthStore` **réutilise** ces briques au lieu de les recopier : ses getters lisent `useUserStore` et `useAuthCookies`, son action `login` appelle `useAuth().login`. C'est aussi une notion de Pinia : un store peut utiliser d'autres stores. Les composants n'ont plus qu'une porte d'entrée, sans qu'on réécrive du code déjà testé (et utilisé par la PR #31 de Marwan, encore ouverte).

## 4. Ce qui est persisté, et ce qui ne l'est pas

`persist` ne recopie que le **state** du store, jamais les getters. Le state de `useAuthStore` ne contient qu'une donnée : `rememberedUsername`, le nom de la dernière connexion réussie, qui pré-remplit `/connexion`. Un test vérifie que `$state` vaut exactement `{ rememberedUsername: 'emilys' }`.

| Donnée                  | Persistée par                  | Pourquoi pas par le plugin                                                                                                                                                                               |
| ----------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nom d'utilisateur       | **le plugin** (cookie `auth`)  | —                                                                                                                                                                                                        |
| `accessToken`           | `useAuthCookies`               | Le plugin écrit **un** cookie par store, avec **une** durée. Le jeton d'accès doit expirer en 30 min, le refresh en 30 jours (#10). Et le refresh (#12) a besoin de la ref partagée de `useAuthCookies`. |
| `refreshToken`          | `useAuthCookies`               | Idem.                                                                                                                                                                                                    |
| Profil de l'utilisateur | rien (rechargé par `/auth/me`) | Toujours à jour, et le profil reste hors des cookies.                                                                                                                                                    |

Persister aussi les jetons via le plugin créerait deux copies du même jeton, qui finiraient par ne plus être d'accord après un refresh.

**Le nom d'utilisateur n'est mémorisé qu'après une connexion réussie** : une faute de frappe ne se retrouve pas pré-remplie. Il est **gardé à la déconnexion** (comme la plupart des sites), et `forgetUsername()` permet de l'effacer.

## 5. Cookie plutôt que localStorage

Configuration globale dans `nuxt.config.ts` : `storage: 'cookies'`, `sameSite: 'lax'`, `secure` en production, un an.

`localStorage` n'existe pas côté serveur : le HTML arriverait avec un champ vide, puis le navigateur le remplirait après l'hydratation (un « saut » visible, et rien sans JavaScript). Un cookie est envoyé avec la requête : le serveur lit le store persisté et le champ est **déjà rempli dans le HTML**. Vérifié par Playwright avec JavaScript désactivé.

## 6. `storeToRefs` dans l'en-tête

```ts
const { user } = storeToRefs(useAuthStore())
```

Déstructurer un store directement (`const { user } = useAuthStore()`) copie la valeur du moment et perd la réactivité : l'en-tête ne changerait pas après la connexion. `storeToRefs` renvoie des refs reliées au store.

## 7. Tests

- `tests/nuxt/authStore.spec.ts` (environnement Nuxt, requête et navigation simulées) : getters reliés à `useUserStore` et aux cookies, login réussi (nom mémorisé) ou refusé (rien mémorisé), logout (jetons et utilisateur vidés, `navigateTo('/', { replace: true })`, nom gardé), `forgetUsername`, `$state` limité au nom d'utilisateur.
- `e2e/connexion.spec.ts` : après une vraie connexion, le cookie `auth` vaut `{ "rememberedUsername": "emilys" }` (aucun jeton) ; après suppression des jetons, `/connexion` **sans JavaScript** a le champ pré-rempli.

## 8. Pour l'équipe

- `useAuthStore` est le point d'entrée pour l'authentification dans les composants : `isAuthenticated` (middleware, en-tête), `user` (page `/compte`), `logout()`.
- Une seule déconnexion (#34) : le `logout()` ajouté dans `useAuth` par #31 faisait la même chose que celui du store ; il a été retiré, `/compte` appelle `useAuthStore().logout()` et le middleware lit `useAuthStore().isAuthenticated`.
- `persist` peut servir à d'autres stores, avec `pick` pour ne garder que le nécessaire. Le panier (#8) garde sa persistance à lui : ses tuples compacts tiennent sous 4 Ko, ce que le JSON objet du plugin ne garantit pas.
