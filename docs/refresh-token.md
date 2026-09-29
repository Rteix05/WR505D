# Rafraîchissement du token en single-flight : choix techniques

Issue #12. Fichiers : `utils/singleFlight.ts`, `utils/authFetch.ts`, `composables/useAuthCookies.ts`, `plugins/01.api.ts`, `tests/unit/singleFlight.spec.ts`, `tests/unit/authFetch.spec.ts`.

## 1. Le problème

L'`accessToken` DummyJSON expire après `expiresInMins` : l'API répond alors `401 { "message": "Token Expired!" }`. Le `refreshToken` (valable 30 jours) permet d'en obtenir un nouveau via `POST /auth/refresh`.

Le piège : une page lance souvent plusieurs requêtes en même temps. Si le jeton vient d'expirer, elles reçoivent toutes une 401. Une implémentation naïve (« sur 401, je rafraîchis ») lancerait **autant de refresh que de requêtes**. Or chaque refresh renvoie un **nouveau** `refreshToken` : les refresh se marchent dessus, et selon l'ordre d'arrivée des réponses, les cookies peuvent finir avec un jeton qui n'est pas le dernier émis.

Le sujet demande donc un refresh **single-flight** : un seul `POST /auth/refresh` part, et toutes les requêtes en échec sont rejouées avec le nouveau jeton.

## 2. `createSingleFlight` : le mécanisme de base

```ts
let inFlight: Promise<T> | null = null
return () => {
  inFlight ??= task().finally(() => {
    inFlight = null
  })
  return inFlight
}
```

- Premier appel : `inFlight` est vide, on lance la tâche et on **garde sa promesse**.
- Appels suivants pendant qu'elle tourne : `??=` ne fait rien, ils reçoivent **la même promesse**. Ils attendent donc le même résultat, sans relancer la tâche.
- Quand la promesse se termine (succès ou échec), `finally` remet `inFlight` à `null` : le prochain refresh (dans 30 minutes) pourra repartir.

On partage la **promesse**, pas le résultat : c'est ce qui permet aux requêtes arrivées pendant le refresh de l'attendre. JavaScript étant mono-thread, aucun verrou n'est nécessaire : entre la lecture et l'écriture de `inFlight`, rien d'autre ne peut s'exécuter.

La fonction est générique (`<T>`) et ne sait rien des jetons : elle est testable seule et réutilisable.

## 3. `createAuthFetch` : le client authentifié

```
authFetch(url)
 ├─ jeton = cookie accessToken, sinon refresh (cookie expiré mais refreshToken présent)
 ├─ requête avec « Authorization: Bearer <jeton> »
 └─ 401 ?
     ├─ le jeton a changé entre-temps → rejouer avec le jeton actuel
     └─ sinon → refresh (single-flight) → rejouer une fois
```

Trois cas délicats, chacun couvert par un test :

**Cookie `accessToken` absent.** Le cookie expire en même temps que le jeton (`maxAge`). Après 30 minutes, le navigateur l'a supprimé mais le `refreshToken` est toujours là : on rafraîchit **avant** d'appeler, au lieu d'envoyer une requête sans jeton vouée à la 401.

**Refresh déjà terminé.** Une requête lente part avec l'ancien jeton. Pendant ce temps, une autre requête reçoit une 401, rafraîchit, et termine : le single-flight est de nouveau libre. Quand la requête lente reçoit enfin sa 401, un simple « sur 401 je rafraîchis » lancerait un **second** refresh inutile. On compare donc le jeton envoyé avec le jeton actuel : s'il a changé, quelqu'un a déjà rafraîchi, on rejoue directement.

**Pas de boucle infinie.** Une requête n'est rejouée qu'une fois. Si le rejeu reçoit encore une 401 (problème côté API), l'erreur remonte à l'appelant au lieu de rafraîchir sans fin.

### Quand la session est-elle perdue ?

| Situation                              | Réaction                                          |
| -------------------------------------- | ------------------------------------------------- |
| Pas de `refreshToken`                  | Session expirée                                   |
| `/auth/refresh` répond une erreur HTTP | Session expirée (refreshToken invalide ou périmé) |
| `/auth/refresh` injoignable (réseau)   | L'erreur remonte, **la session est gardée**       |
| Autre erreur que 401 (404, 500…)       | L'erreur remonte telle quelle, pas de refresh     |

« Session expirée » = `onSessionExpired()` (cookies et store vidés, une seule fois même si plusieurs requêtes attendaient, grâce au single-flight) puis `SessionExpiredError` pour chaque requête. Une coupure réseau ne doit pas déconnecter l'utilisateur : son `refreshToken` est peut-être encore valide.

## 4. Inversion des dépendances : pourquoi `deps`

`createAuthFetch` ne connaît ni `$fetch`, ni `useCookie`, ni Pinia. Tout lui est fourni :

```ts
createAuthFetch({
  request,
  getAccessToken,
  getRefreshToken,
  refreshTokens,
  saveTokens,
  onSessionExpired,
})
```

- **Testable** : le test branche un faux DummyJSON (qui n'accepte que le jeton valide actuel et contrôle quand les réponses arrivent) et vérifie le nombre exact d'appels à `/auth/refresh`, sans réseau ni Nuxt.
- **Remplaçable** : `plugins/01.api.ts` branche la vraie implémentation. Changer de client HTTP ou de stockage des jetons ne touche pas à la logique.

## 5. Une instance par visiteur (`plugins/01.api.ts`)

Le client est créé dans un plugin et exposé en `$authFetch`. Un plugin s'exécute une fois par application Nuxt : dans le navigateur, une fois ; **côté serveur, une fois par requête HTTP**.

C'est essentiel. Si le client était une variable globale d'un module, le serveur (qui traite tous les visiteurs dans le même processus) partagerait un seul single-flight entre tous : le refresh de l'utilisateur A pourrait être servi à l'utilisateur B, qui recevrait les jetons de A.

Le plugin est numéroté `01.` et le chargement de l'utilisateur `02.auth.server.ts` : Nuxt exécute les plugins dans l'ordre alphabétique, `$authFetch` existe donc avant que `/auth/me` ne soit appelé.

## 6. Une seule ref par cookie (`useAuthCookies`)

Constat en lisant le code source de Nuxt (`node_modules/nuxt/dist/app/composables/cookie.js`) : chaque appel à `useCookie('accessToken')` crée une **nouvelle ref**.

- Côté serveur, ces refs ne se synchronisent pas entre elles.
- Côté navigateur, elles se synchronisent, mais de façon asynchrone.

Or juste après un refresh, `authFetch` relit le jeton pour rejouer les requêtes : avec deux refs, il pourrait lire l'ancien. `useAuthCookies()` crée donc les refs une seule fois par application (mises en cache dans une `WeakMap` indexée par `nuxtApp`, donc une par requête côté serveur) : `useAuth`, le plugin et plus tard la déconnexion (#11) partagent exactement les mêmes. La `WeakMap` libère l'entrée automatiquement quand l'application de la requête est terminée.

Le premier appel a lieu dans le plugin, qui vit aussi longtemps que l'application. S'il avait lieu dans un composant, Nuxt arrêterait de synchroniser le cookie au démontage de ce composant.

## 7. Côté serveur

`useAuth().loadUser()` utilise maintenant `$authFetch`. Au rechargement d'une page après expiration du jeton, le serveur rafraîchit le jeton **avant** le rendu, renvoie les nouveaux cookies dans la réponse (`Set-Cookie`) et affiche la page connectée : l'utilisateur ne voit rien.

## 8. Tests

**Unitaires** (`tests/unit/`, 100 % de couverture sur les deux fichiers) :

- `singleFlight.spec.ts` : appels simultanés = une exécution ; relance après la fin ; échec partagé puis relance possible.
- `authFetch.spec.ts` : 3 requêtes simultanées en 401 → **1 seul refresh**, 3 rejeux avec le nouveau jeton ; 401 après un refresh terminé → pas de second refresh ; cookie absent ; refreshToken refusé (session expirée une seule fois) ; erreur réseau (session gardée) ; erreur 404 ; pas de boucle infinie ; options et headers conservés.

**Manuel avec `expiresInMins: 1`** :

```bash
NUXT_PUBLIC_AUTH_EXPIRES_IN_MINS=1 npm run dev
```

Connexion, attente de 65 secondes (l'API répond alors `401 Token Expired!`), puis rechargement :

| Cookies envoyés                          | Résultat                                                  |
| ---------------------------------------- | --------------------------------------------------------- |
| accessToken expiré + refreshToken        | Nouveaux cookies dans la réponse, page « Bonjour, Emily » |
| refreshToken seul (cookie access expiré) | Nouveaux cookies dans la réponse, page « Bonjour, Emily » |
| refreshToken invalide                    | Cookies supprimés (`Max-Age=0`), page déconnectée         |
