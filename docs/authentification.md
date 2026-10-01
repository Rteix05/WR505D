# Authentification : choix techniques

Issue #10. Fichiers : `types/dummyjson.ts`, `utils/auth.ts`, `stores/user.ts`, `composables/useAuth.ts`, `plugins/auth.server.ts`, `pages/connexion.vue`, `tests/unit/auth.spec.ts`.

## 1. Vue d'ensemble

```
pages/connexion.vue ──► useAuth().login() ──► POST /auth/login
                                         │
                                         ├─► cookies accessToken / refreshToken
                                         └─► store user (profil réduit)

Rechargement de page (serveur) :
plugins/auth.server.ts ──► useAuth().loadUser() ──► GET /auth/me (Bearer <cookie>)
                                                └─► store user ──► HTML + payload envoyés au navigateur
```

Chaque fichier a un seul rôle (responsabilité unique) :

| Fichier                  | Rôle                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `types/dummyjson.ts`     | Types des réponses DummyJSON et de l'utilisateur gardé            |
| `utils/auth.ts`          | Fonctions pures : réduction du profil, redirection sûre, messages |
| `stores/user.ts`         | État : qui est connecté                                           |
| `composables/useAuth.ts` | Appels API et cookies : le seul endroit qui parle à `/auth/*`     |
| `plugins/auth.server.ts` | Charge l'utilisateur côté serveur avant le rendu                  |
| `pages/connexion.vue`    | Formulaire et affichage des erreurs                               |

La page et le layout ne connaissent que `useAuth()` : ils ne savent pas que les jetons sont en cookies ni quelle URL est appelée (inversion des dépendances). Si on change la façon de stocker les jetons, seul `useAuth` change.

## 2. Pas de « flash » de l'état déconnecté

Le problème : si l'utilisateur était chargé dans le navigateur (`onMounted`), le serveur enverrait d'abord une page « déconnecté » (lien « Connexion »), puis la page basculerait sur « Bonjour, Emily » une fois le JavaScript exécuté.

La solution : `plugins/auth.server.ts` (le suffixe `.server` le limite au serveur) appelle `GET /auth/me` **avant** le rendu. Le serveur lit le cookie de la requête (`useCookie` fonctionne côté serveur), le store Pinia est rempli, le HTML est généré dans l'état connecté, puis l'état du store est transmis au navigateur dans le payload Nuxt. Le navigateur reprend cet état sans refaire l'appel.

Vérifié : avec un cookie valide, `curl http://localhost:3000/` renvoie directement « Bonjour, Emily » dans le HTML, sans JavaScript.

## 3. Le profil réduit (`toAuthUser`) : une question de sécurité

`GET /auth/me` renvoie le profil complet, y compris **le mot de passe, le numéro de carte bancaire, l'IBAN et le numéro de sécurité sociale** (données fictives, mais c'est le principe).

Or l'état Pinia est sérialisé dans le HTML envoyé au navigateur. Stocker la réponse brute reviendrait à écrire ces données dans le code source de chaque page. `toAuthUser` ne garde que ce qui sert à l'affichage (id, nom d'utilisateur, e-mail, prénom, nom, avatar).

Les champs sensibles ne sont même pas déclarés dans `User` : impossible de les utiliser par erreur, TypeScript refuserait. Vérifié : le HTML d'une page connectée ne contient ni `emilyspass`, ni le numéro de carte.

## 4. Les cookies

| Cookie         | Durée                               | Pourquoi                                                                      |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| `accessToken`  | `expiresInMins` (30 min par défaut) | Expire en même temps que le jeton : on n'envoie jamais un jeton déjà périmé   |
| `refreshToken` | 30 jours                            | Durée de vie du refreshToken chez DummyJSON (lue dans le jeton : `exp - iat`) |

Options : `path: '/'` (disponible sur tout le site), `sameSite: 'lax'` (le cookie n'est pas envoyé par les requêtes provenant d'autres sites, protection CSRF de base), `secure` en production (HTTPS uniquement ; désactivé en dev car `localhost` est en HTTP).

**Pourquoi pas `httpOnly` ?** Un cookie `httpOnly` est invisible pour le JavaScript, ce qui protège mieux contre le vol de jeton par une faille XSS. Mais `useCookie` écrit le cookie depuis le navigateur après la connexion, ce qui est impossible avec `httpOnly`. Il faudrait une route serveur Nuxt (`server/api/auth/login.post.ts`) qui appelle DummyJSON et pose elle-même le cookie. C'est la bonne pratique en production ; ici le sujet demande explicitement `useCookie`, et DummyJSON est une API de démonstration. Limite connue, assumée.

La durée `expiresInMins` est dans `runtimeConfig.public.authExpiresInMins` : pour tester l'expiration (issue #12), on lance `NUXT_PUBLIC_AUTH_EXPIRES_IN_MINS=1 npm run dev` sans toucher au code.

## 5. Redirection après connexion (`safeRedirect`)

La page lit `?redirect=/compte` pour renvoyer l'utilisateur là où il allait (le middleware de l'issue #11 ajoutera ce paramètre). Sans vérification, c'est une faille connue, l'**open redirect** : un lien piégé `…/connexion?redirect=https://site-pirate.com` enverrait l'utilisateur, juste après sa connexion, vers une fausse page.

`safeRedirect` n'accepte que les chemins internes :

- doit commencer par `/` ;
- refuse `//site.com` et `/\site.com` (les navigateurs les interprètent comme une autre adresse) ;
- refuse la page de connexion elle-même, sous toutes ses formes : `/connexion`, `/connexion/`, `/Connexion`, `/connexion#…`, `/connexion?…` (boucle inutile). La comparaison se fait sur le chemin seul, sans slash final et en minuscules, car vue-router ignore la casse (ajouté suite à la review de #16) ;
- sinon, repli sur l'accueil.

La fonction reçoit `unknown` car `route.query.redirect` peut être une chaîne, un tableau (`?redirect=a&redirect=b`) ou absent : on vérifie le type avant de l'utiliser (narrowing), sans `any`.

Si l'utilisateur est déjà connecté, `/connexion` le redirige directement (vérifié côté serveur : réponse 302).

## 6. Gestion des erreurs (`loginErrorMessage`)

Réponses réelles observées :

| Cas                       | Réponse DummyJSON                                     |
| ------------------------- | ----------------------------------------------------- |
| Mauvais mot de passe      | `400 { "message": "Invalid credentials" }`            |
| Champs manquants          | `400 { "message": "Username and password required" }` |
| `/auth/me` sans jeton     | `401 { "message": "Access Token is required" }`       |
| `/auth/me` jeton invalide | `401 { "message": "Invalid/Expired Token!" }`         |

On n'affiche pas le message anglais de l'API : `loginErrorMessage` traduit le code HTTP en message français. `httpStatusOf(error: unknown)` lit le `statusCode` de l'erreur `$fetch` en vérifiant le type étape par étape. Sans `statusCode`, la requête n'est jamais arrivée : c'est une erreur réseau, avec un message différent.

Le message ne dit pas si c'est l'identifiant ou le mot de passe qui est faux : le préciser aiderait quelqu'un qui cherche des noms d'utilisateur existants.

## 7. Accessibilité du formulaire

- Chaque champ a un `<label for>` visible.
- `autocomplete="username"` et `"current-password"` : les gestionnaires de mots de passe remplissent le formulaire.
- Champ vide : message sous le champ, relié par `aria-describedby`, champ marqué `aria-invalid="true"`, et le focus est placé sur le premier champ en erreur. `novalidate` désactive les bulles natives du navigateur, peu lisibles et mal annoncées, au profit de nos messages.
- Erreur de connexion : message dans une zone `role="alert"`, annoncée immédiatement par les lecteurs d'écran. Cette zone est **toujours présente dans le DOM**, même vide : un lecteur d'écran n'annonce de façon fiable que les changements d'une zone qui existait déjà.
- Bouton désactivé et `aria-busy` pendant l'envoi : pas de double soumission.
- Le mot de passe est vidé après un échec.
- Contour de focus visible (`:focus-visible`), page `noindex` (inutile dans les moteurs de recherche).

## 8. Tests

`tests/unit/auth.spec.ts` teste les fonctions pures :

- `toAuthUser` : avec une réponse `/auth/me` contenant mot de passe et carte bancaire, le résultat ne les contient pas ;
- `safeRedirect` : chemins internes acceptés, 10 cibles dangereuses ou inutiles refusées ;
- `httpStatusOf` et `loginErrorMessage` : erreurs 400, 401, 500 et réseau.

Testé à la main : validation des champs vides (focus, `aria-invalid`), rendu serveur connecté avec un cookie valide, jeton invalide traité comme déconnecté, redirections 302 depuis `/connexion`.

## 9. Ce qui est laissé aux autres issues

- **#11** (Marwan) : middleware `auth` sur `/compte`, déconnexion (vider les cookies et le store). Il utilisera `useAuth()` et `useUserStore().setUser(null)`.
- **#12** : quand `/auth/me` renvoie 401, rafraîchir le jeton avec `refreshToken` au lieu de considérer l'utilisateur déconnecté.
- **#1** (Radouan) : fait, les types d'authentification sont dans `types/dummyjson.ts` (`MeResponse` renommé `User`).
