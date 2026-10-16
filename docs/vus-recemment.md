# Produits vus récemment : choix techniques

Issue #49 (logique pure) puis #50 (cookie, accueil, fiche produit).

Fichiers : `utils/recentlyViewed.ts`, `stores/recentlyViewed.ts`, `components/product/RecentlyViewed.vue`, `types/recentlyViewed.ts`, `tests/unit/recentlyViewed.spec.ts`, `tests/nuxt/recentlyViewedStore.spec.ts`, `e2e/vus-recemment.spec.ts`.

Les sections 1 à 6 concernent la logique pure (#49), les sections 7 à 12 l'affichage (#50).

## 1. Les fonctions

Signatures imposées par le sujet :

```ts
pushRecentlyViewed(ids: number[], id: number, max = 10): number[]
parseRecentlyViewedCookie(raw: unknown): number[]
```

Plus `serializeRecentlyViewed(ids): string`, l'inverse de `parseRecentlyViewedCookie`, pour que lecture et écriture du cookie soient au même endroit et testées ensemble.

Fonctions pures (sans Vue, Pinia ni cookie) : elles reçoivent un tableau et en renvoient un nouveau, sans le modifier. Testées en environnement Node, sans monter Nuxt. Même découpage que le panier (`utils/cart.ts`) : #50 n'aura qu'à lire le cookie, appeler ces fonctions et écrire le résultat.

## 2. `pushRecentlyViewed` : l'ordre

Le produit visité passe **en tête**. S'il y était déjà, il **remonte** (pas de doublon). Au-delà de 10, **le plus ancien sort** (le dernier du tableau).

```
historique       visite   résultat
[3, 2, 1]        4        [4, 3, 2, 1]              nouveau : en tête
[3, 2, 1]        1        [1, 3, 2]                 déjà vu : remonte
[1, 2, …, 10]    42       [42, 1, 2, …, 9]          plein : 10 sort
[1, 2, …, 10]    10       [10, 1, 2, …, 9]          plein mais déjà vu : rien ne sort
```

Ordre des opérations : on retire d'abord le doublon, puis on coupe à 10. Dans l'autre ordre, revoir un produit déjà dans l'historique plein ferait sortir un produit pour rien.

Identifiant invalide (0, négatif, décimal, `NaN`) : historique inchangé. Ça ne devrait pas arriver (la fiche produit valide déjà l'identifiant avec `parseProductId`, #6), mais la fonction ne doit pas pouvoir écrire n'importe quoi dans le cookie.

## 3. `parseRecentlyViewedCookie` : ne jamais planter

Le cookie vient du navigateur : il peut être absent, ancien ou modifié à la main. La fonction reçoit `unknown` et ne lève **jamais** d'erreur : au pire, l'historique est vide.

### Les formes possibles

`useCookie` essaie de décoder la valeur lui-même (bibliothèque `destr`). Vérifié :

| Cookie brut | Reçu par la fonction |
| ----------- | -------------------- |
| `12,5,3`    | `"12,5,3"` (texte)   |
| `12`        | `12` (nombre)        |
| `[12,5]`    | `[12, 5]` (tableau)  |
| `[1,`       | `"[1,"` (texte)      |
| absent      | `undefined`          |

La fonction accepte donc un texte (séparé par des virgules ou en JSON), un tableau et un nombre seul. Tout le reste (objet, booléen, `null`) donne un historique vide.

### Chaque valeur validée une par une

Une seule valeur invalide ne vide pas tout l'historique : seule elle est ignorée.

| Entrée          | Résultat    | Pourquoi                                       |
| --------------- | ----------- | ---------------------------------------------- |
| `"5,5,5"`       | `[5]`       | doublons retirés                               |
| `"3,1,3,2"`     | `[3, 1, 2]` | la 1ʳᵉ occurrence (la plus récente) est gardée |
| `"1,,2"`        | `[1, 2]`    | valeur vide ignorée                            |
| `"7,abc,-1,8"`  | `[7, 8]`    | texte et négatif ignorés                       |
| `"abc"`         | `[]`        | rien de valide                                 |
| `"[1,"`         | `[]`        | JSON invalide                                  |
| 15 identifiants | les 10 1ᵉʳˢ | cookie trafiqué : on ne dépasse jamais 10      |

Un identifiant valide = entier ≥ 1, écrit **uniquement en chiffres** : `1.5`, `1e3`, `0x10` ou `99999999999999999999` (trop grand pour être exact en JavaScript) sont refusés. Même règle que `parseProductId` de la fiche produit, mais pas réutilisée : elle reçoit un texte d'URL, alors que le cookie peut arriver en nombre ou en tableau.

## 4. Format du cookie : `12,5,3`

Identifiants uniquement (consigne du sujet), séparés par des virgules.

`useCookie` écrit un texte tel quel (sans le transformer en JSON) mais encode les virgules (`%2C`). Mesuré pour 10 identifiants à 3 chiffres :

| Format             | Valeur écrite dans le cookie         |
| ------------------ | ------------------------------------ |
| `191,192,…`        | 57 octets                            |
| JSON `[191,192,…]` | 63 octets (`[`, `]` encodés en plus) |

L'écart est faible : les deux sont très loin de la limite de 4 Ko. Le format à virgules est retenu parce qu'il est un peu plus court, lisible dans les outils du navigateur, et que `useCookie` le rend tel quel, sans dépendre de son décodage JSON. Le JSON reste accepté à la lecture, au cas où un cookie aurait été écrit autrement.

## 5. Tests

`tests/unit/recentlyViewed.spec.ts`, 33 tests (couverture : 100 % des lignes, 97 % des branches ; la branche restante est une sécurité de typage impossible à atteindre) :

- `pushRecentlyViewed` : historique vide, nouveau produit, produit déjà vu (remonte), dépassement de 10 (le plus ancien sort), historique plein avec un produit déjà présent, `max` personnalisé et à 0, 4 identifiants invalides, tableau d'entrée non modifié ;
- `parseRecentlyViewedCookie` : format du site, nombre seul, tableaux (nombres, textes, JSON), `"5,5,5"`, ordre des doublons, `"1,,2"`, valeurs invalides mélangées, plus de 10 identifiants, identifiant trop grand, et 10 entrées qui doivent donner un historique vide sans erreur (`"abc"`, `[]`, `null`, `undefined`, `""`, JSON invalide, JSON qui n'est pas un tableau, objet, booléen, nombre négatif) ;
- `serializeRecentlyViewed` : aller-retour sans perte, taille du pire cas (39 caractères, 57 octets une fois encodé), historique vide.

## 6. Suites de la review de #59

- Le commentaire de `serializeRecentlyViewed` disait « ≈ 40 octets » : c'est 57 une fois encodé, comme mesuré plus haut. Corrigé, et le test vérifie maintenant la taille avec `encodeURIComponent`.
- `1e3` : `useCookie` ne le convertit pas en nombre (`String(1000)` n'est pas `"1e3"`), il reste du texte et il est refusé. Vérifié avec le décodeur de Nuxt.
- `pushRecentlyViewed` ne revérifie pas son tableau : il doit venir de `parseRecentlyViewedCookie` (précisé dans la JSDoc).
- Un identifiant valide peut ne correspondre à aucun produit : cas traité avec l'affichage (#50).

---

# Partie 2 : affichage et cookie (#50)

## 7. Découpage

| Élément                    | Rôle                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `stores/recentlyViewed.ts` | Historique (identifiants), cookie `recently_viewed`, produits connus en mémoire     |
| `<ProductRecentlyViewed>`  | Section « Produits vus récemment » (accueil et bas de la fiche), bouton « Effacer » |
| `pages/produits/[id].vue`  | Enregistre la visite, une fois la fiche chargée                                     |
| `utils/recentlyViewed.ts`  | `isCanonicalRecentlyViewed` : le cookie est-il à réécrire ?                         |

Les cartes réutilisent `<ProductCard>`. Seul changement du composant partagé : une propriété `headingLevel` (2 par défaut, donc rien ne change ailleurs). Dans la section, les cartes sont des `h3` sous le `h2` « Produits vus récemment » : sinon la hiérarchie des titres serait fausse pour un lecteur d'écran.

## 8. Quand une visite compte

La visite est enregistrée **dans la page de la fiche, après le chargement du produit** :

| Cas                                    | Visite enregistrée ?                    |
| -------------------------------------- | --------------------------------------- |
| Produit existant                       | oui                                     |
| `/produits/99999` (404 de l'API)       | non : `notFound()` a déjà levé l'erreur |
| `/produits/abc` (identifiant invalide) | non : refusé avant tout appel           |
| Erreur réseau (produit non chargé)     | non : on ne sait pas s'il existe        |

L'enregistrement a lieu au rendu serveur comme dans le navigateur : sans effet si le produit est déjà en tête, donc pas de cookie réécrit pour rien. Vérifié : une 404 puis une visite valide donnent le cookie `1`, pas `99999,1`.

## 9. Stratégie de chargement des produits

Le cookie ne contient que des identifiants. Pour afficher des cartes, il faut le titre, le prix, la note, la remise et l'image.

**Retenu : `getProductsByIds` (#45) avec `select`, un appel par produit, en parallèle, et seulement pour les produits inconnus.**

Mesures sur l'API réelle, pour 10 produits :

| Stratégie                                      | Poids                            |
| ---------------------------------------------- | -------------------------------- |
| 10 appels avec `select` (retenu)               | 1 916 octets (1 697 transférés)  |
| 10 appels sans `select`                        | 15 449 octets                    |
| Toute la liste des 194 produits, avec `select` | 37 585 octets (6 365 transférés) |

- **`select`** : une carte n'affiche que 5 champs. Sans lui, on télécharge 8 fois plus (descriptions, avis, dimensions…).
- **Pas toute la liste** : 20 fois plus lourd pour afficher au plus 10 produits. Cette stratégie est la bonne pour le filtre de prix (#5), qui doit voir tous les produits, mais pas ici.
- **`getProductsByIds`** : une seule méthode pour tout le site (comparateur, panier, vus récemment). Les 404 sont séparés des pannes réseau : un produit supprimé se retire de l'historique, un produit en échec réseau est simplement non affiché cette fois, sans être retiré (il existe peut-être).
- **Seulement les produits inconnus.** Un produit qu'on vient de visiter est gardé en mémoire (`known`) : revenir de la fiche à l'accueil ne refait **aucun appel**. Seul un rechargement complet de la page (qui ne laisse que les identifiants du cookie) déclenche les appels, et le serveur les attend : la liste arrive dans le HTML.

## 10. Cookie

- Nom `recently_viewed`, **identifiants uniquement**, 30 jours, `sameSite: lax`, `secure` en production. Vérifié par un test (options) et par Playwright (valeur `3,2,1`, jamais de titre).
- **Une seule ref** pour tout le store (même raison que le comparateur et `useAuthCookies`).
- Quand l'historique est vide (après « Effacer »), le cookie est **supprimé** plutôt que renvoyé vide à chaque requête.
- **Cookie corrompu : ignoré et réinitialisé.** `parseRecentlyViewedCookie` lit ce qui est valable, puis `isCanonicalRecentlyViewed` compare le cookie à ce que l'application écrirait. S'il diffère, le store le réécrit tout de suite : `abc,,-5` est supprimé, `2,abc,2,9999` devient `2`. Sans ça, le cookie corrompu serait relu et ignoré à chaque visite, sans jamais être corrigé.
- **Encodage cassé** (`%E0%A4%A`) : vérifié sur le site construit, aucune variante ne provoque d'erreur 500 (le décodeur de cookies tolère les erreurs).
- Un cookie dont tous les identifiants sont valides mais qui ne correspond à aucun produit (9999) : retiré dès que l'API répond 404.

## 11. Sans erreur d'hydratation, sans clignotement

Deux pièges déjà rencontrés avec le comparateur (review de #62), évités ici dès le départ :

- **`known` est renvoyé par le store.** Pinia ne transmet au navigateur que les refs renvoyées. Sinon le serveur affiche les cartes, mais le navigateur part d'un état vide : cartes absentes, appels refaits.
- **`useAsyncData` ne renvoie jamais `null`.** Nuxt ne réutilise le résultat du serveur que s'il n'est pas nul. Avec `null`, le navigateur relancerait la fonction au chargement. Elle renvoie la liste des identifiants chargés.

Deux tests Playwright le vérifient en écoutant les requêtes du **navigateur** (celles du serveur lui sont invisibles) : après un rechargement, et en allant de la fiche à l'accueil : aucun appel vers l'API.

Autre piège, rencontré en écrivant les tests : Nuxt nomme un composant d'après son chemin. `components/product/RecentlyViewed.vue` s'appelle donc `ProductRecentlyViewed`, et un `<RecentlyViewed />` est rendu comme une balise inconnue, sans erreur en production. Lint et typecheck ne le voient pas : c'est Playwright qui l'a révélé (la section n'apparaissait pas).

## 12. Le bouton « Effacer l'historique » et l'accessibilité

- **Avec JavaScript seulement** (`<ClientOnly>`) : sans lui, le bouton serait affiché mais inutilisable. Sans JavaScript, la liste s'affiche (dans le HTML du serveur) mais ne s'efface pas. Même choix que le tableau comparatif (#48).
- **Focus** : le bouton cliqué disparaît avec la liste. La section reste avec son titre et le texte « Votre historique a été effacé. », et le focus va sur le titre (sinon il retomberait en haut de la page). Après un rechargement, la section n'est plus affichée.
- **Annonce** : zone `aria-live="polite"` toujours présente, « Historique effacé. ». Sans `role="status"` : les tests du catalogue cherchent leur propre zone `role="status"` (une seule par page), et en ajouter une sur toutes les pages les cassait (leçon de #62).
- **Rien d'affiché sans historique** : pas de titre vide sur l'accueil d'un nouveau visiteur.
- Sur la fiche, le produit courant n'est pas dans sa propre liste.
- **Mobile** : deux colonnes. La zone disponible fait 311 px à 375 px de large : 2 cartes de 9,5 rem (320 px avec l'espace) ne tenaient pas et donnaient une seule colonne (2 300 px de haut pour 4 produits). À 8,5 rem, deux colonnes, environ 1 100 px.

## 13. Tests de l'affichage

- `tests/unit/recentlyViewed.spec.ts` (+16 tests, 49 en tout) : `isCanonicalRecentlyViewed` (cookie absent, format du site, nombre seul, 11 formes à réécrire) et les constantes du cookie.
- `tests/nuxt/recentlyViewedStore.spec.ts` (22 tests, `useCookie` remplacé par un stockage en mémoire : le cookie est `secure`, un navigateur de test en `http` ne le renverrait pas) : visites en tête, revisite sans doublon, même produit deux fois de suite sans réécriture, **10 maximum**, options du cookie, persistance, identifiants uniquement, **`known` dans l'état transmis**, produits connus et inconnus, 404 retiré, effacer, et 7 cookies corrompus réécrits.
- `e2e/vus-recemment.spec.ts` (Playwright, build de production, vraie API, 17 tests) : visites en tête avec cookie `3,2,1` ; revisite ; bas de la fiche sans le produit courant ; première visite sans section ; 404 et identifiant invalide sans effet ; 10 maximum ; effacer (annoncé, focus, cookie supprimé, section absente au rechargement) et au clavier ; cookie illisible, encodage cassé, identifiants mélangés (`2,abc,2,9999` → `2`) ; **aucun appel du navigateur** après un rechargement et de la fiche à l'accueil ; sans JavaScript (liste dans le HTML, pas de bouton inutilisable, visite enregistrée par le serveur) ; axe-core sur l'accueil et sur la fiche avec un historique.

Les identifiants 1, 2 et 3 sont des données fixes de l'API de démonstration : si DummyJSON les changeait, ces tests casseraient, la CI le signalerait.
