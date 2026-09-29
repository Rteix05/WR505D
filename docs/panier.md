# Panier : choix techniques

Issue #8. Fichiers : `types/cart.ts`, `utils/cart.ts`, `stores/cart.ts`, `tests/unit/cart.spec.ts`.

## 1. Découpage : fonctions pures + store fin

| Couche        | Fichier            | Rôle                                                                 |
| ------------- | ------------------ | -------------------------------------------------------------------- |
| Types         | `types/cart.ts`    | `CartItem`, `CartProduct`, format du cookie                          |
| Règles        | `utils/cart.ts`    | Ajouter, modifier, retirer, limite de stock, lecture/écriture cookie |
| État          | `stores/cart.ts`   | Garde les lignes, appelle les règles, écrit le cookie                |
| Récapitulatif | `computeCart` (#7) | Brut, remises, livraison, total : **jamais recalculé ailleurs**      |

Toute la logique est dans `utils/cart.ts`, en fonctions pures (elles reçoivent un tableau et en renvoient un nouveau, sans le modifier). On les teste en environnement Node, sans monter Nuxt ni Pinia. Le store ne fait qu'enchaîner : appeler la règle → remplacer les lignes → écrire le cookie → renvoyer le message.

Le récapitulatif (`summary`) est un `computed` sur `computeCart(toCartLines(items), promoCode)`. Il n'est jamais stocké, donc il ne peut pas être désynchronisé des lignes.

## 2. Le stock : ne jamais le dépasser, et le dire

Chaque ligne garde le `stock` du produit au moment de l'ajout. `addToCart` et `updateCartQuantity` bornent la quantité avec `Math.min(voulu, stock)` et renvoient un message :

| Situation                           | Résultat                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| 4 dans le panier, stock 5, ajout +3 | Quantité 5, « Stock insuffisant : seulement 5 exemplaires disponibles. La quantité a été ajustée. » |
| 5 dans le panier, stock 5, ajout +1 | Panier inchangé, « Vous avez déjà les 5 exemplaires disponibles dans votre panier. »                |
| Stock 0                             | Rien n'est ajouté, « Ce produit est en rupture de stock. »                                          |
| Quantité 0, négative ou décimale    | Rien ne change, « La quantité doit être un nombre entier d'au moins 1. »                            |

**Pourquoi borner plutôt que refuser ?** Si on demande 10 et qu'il en reste 5, on a sûrement envie des 5 : on les met et on explique. Refuser tout obligerait l'utilisateur à deviner la bonne quantité.

**Pourquoi un message renvoyé et pas stocké dans le store ?** Le message concerne une action précise (« ce clic-là »). C'est au composant qui a déclenché l'action de l'afficher, là où l'utilisateur regarde (zone `aria-live` à côté du bouton). Un message global dans le store resterait affiché ailleurs après coup.

À l'ajout, prix, catégorie et stock sont **repris du produit** : ce sont les données les plus récentes de l'API.

## 3. Le cookie : moins de 4 Ko, présent dès le rendu serveur

### Pourquoi un cookie (et pas `localStorage`)

`localStorage` n'existe que dans le navigateur : pendant le rendu serveur, le panier serait vide, puis il « sauterait » à l'affichage. Le cookie est envoyé avec chaque requête : `useCookie` le lit côté serveur, le store est rempli avant le rendu, et Pinia transmet l'état au navigateur avec le HTML.

### Ce qu'on stocke

Seulement ce dont `computeCart` a besoin, plus le stock pour la limite : `productId`, `quantity`, `unitPriceCents`, `category`, `stock`. Et le code promo, pour qu'il survive à un rechargement. Pas de titre, pas d'image, pas de description : ils sont rechargés depuis l'API par la page panier (#9).

### Pourquoi des tuples

`useCookie` fait `encodeURIComponent(JSON.stringify(valeur))` : chaque `"` devient `%22`, chaque `:` `%3A`, chaque `,` `%2C`. Les noms de propriétés répétés à chaque ligne coûtent donc très cher. Mesure dans le pire cas (30 lignes, id 194, quantité 100, prix 9 999,99 €, catégorie `sports-accessories`, code de 32 caractères) :

| Format                                             | Taille de l'en-tête `cart=…` |
| -------------------------------------------------- | ---------------------------- |
| Objets `{"productId":194,"quantity":100,…}`        | 4 557 octets : **trop gros** |
| Tuples `[194,100,999999,"sports-accessories",100]` | 1 887 octets                 |

D'où le type `CartCookieLine` (tuple nommé) et la limite `MAX_CART_LINES = 30` produits différents. Un test recalcule la taille du pire cas à chaque exécution : si quelqu'un ajoute un champ, le test casse avant la prod.

Alternative rejetée : ne stocker que `productId` et `quantity`, puis recharger chaque produit depuis l'API. Le cookie serait minuscule, mais le récapitulatif demanderait N appels réseau avant chaque rendu, y compris pour le simple badge de l'en-tête.

### Un cookie qu'on ne croit pas sur parole

Le cookie vient du navigateur : il peut être absent, ancien, ou modifié à la main. `parseCart(value: unknown)` valide tout (`unknown` + narrowing, pas de `any`) :

- ligne mal formée, prix négatif, quantité nulle, stock nul, doublon : ligne ignorée ;
- quantité supérieure au stock : ramenée au stock ;
- plus de 30 lignes : les suivantes ignorées ;
- code promo : doit être une chaîne, espaces retirés, 32 caractères max.

Le pire qui puisse arriver est un panier vide, jamais une page qui plante.

**Limite connue** : le prix vient du cookie, donc un utilisateur peut le modifier. Pour une vraie boutique, le prix serait revérifié côté serveur au paiement (le sujet le rappelle pour les promotions). Ici, il n'y a pas de paiement, et la page panier (#9) resynchronise prix et stock avec l'API.

## 4. Stratégie de tests

`tests/unit/cart.spec.ts` (Vitest, environnement Node) :

- ajout : nouvelle ligne, cumul, stock dépassé, stock atteint, rupture, quantités invalides, 31ᵉ produit refusé, données produit mises à jour, tableau d'entrée non modifié ;
- modification de quantité : bornage au stock, valeurs invalides, produit absent ;
- `toCartLines` branché sur `computeCart` (scénario 1 du sujet : 31,87 €) ;
- cookie : aller-retour sans perte, format tuple, **taille du pire cas < 4 Ko**, cookies illisibles ou trafiqués.
