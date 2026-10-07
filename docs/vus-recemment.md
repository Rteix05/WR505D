# Produits vus récemment : choix techniques

Issue #49 (logique pure). L'affichage (cookie, accueil, fiche produit) viendra avec #50.

Fichiers : `utils/recentlyViewed.ts`, `tests/unit/recentlyViewed.spec.ts`.

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

Un identifiant valide = entier ≥ 1, écrit **uniquement en chiffres** : `1.5`, `1e3`, `0x10` ou `99999999999999999999` (trop grand pour être exact en JavaScript) sont refusés. Même règle que `parseProductId` de la fiche produit.

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
- `serializeRecentlyViewed` : aller-retour sans perte, taille du pire cas (< 50 caractères avant encodage), historique vide.
