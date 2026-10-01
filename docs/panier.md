# Panier : choix techniques

Issues #8 (store) et #9 (page `/panier`). Fichiers : `types/cart.ts`, `utils/cart.ts`, `utils/cartDetails.ts`, `stores/cart.ts`, `composables/useCartProducts.ts`, `components/cart/`, `pages/panier.vue`, `tests/unit/cart.spec.ts`, `tests/unit/cartDetails.spec.ts`.

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

## 5. Page `/panier` (#9)

### Découpage

| Élément                | Rôle                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| `pages/panier.vue`     | Assemble tout, gère les messages et le focus                          |
| `useCartProducts()`    | Recharge titre, image, prix et stock depuis l'API, resynchronise      |
| `<CartItemRow>`        | Une ligne : quantité (−, champ, +), total, remise beauté, « Retirer » |
| `<CartPromoForm>`      | Champ code promo, messages de refus, « Retirer le code »              |
| `<CartSummaryPanel>`   | Brut, chaque remise avec sa raison, livraison, total                  |
| `utils/cartDetails.ts` | Textes et montants d'affichage (fonctions pures, testées)             |

Les composants ne calculent rien : ils reçoivent des props typées (`defineProps<…>()`) et émettent des événements (`defineEmits<…>()`). Le montant de chaque remise vient toujours de `computeCart`, jamais d'un second calcul.

### Recharger les produits depuis l'API

Le cookie ne contient ni titre ni image (voir section 3). La page recharge donc chaque produit avec `GET /products/{id}?select=title,thumbnail,price,stock,category`, en parallèle.

- **`$fetch` et pas `$authFetch`** : le catalogue est public, et `$authFetch` sans session lève `SessionExpiredError`.
- **`Promise.allSettled`** : un produit supprimé (404) ou une erreur réseau n'empêche pas d'afficher le reste. La ligne reste, avec le titre « Produit n° 12 ».
- **Resynchronisation** (`syncCartWithProducts`) : le cookie peut dater de plusieurs jours. Si le prix a changé, on met à jour et on prévient (« Le prix de « Mascara » a changé : 9,99 € → 12,50 € »). Si le stock a baissé, la quantité est ajustée. Si le produit est en rupture, la ligne est retirée. Chaque changement est expliqué dans un encadré en haut de page.
- Fait **dans le `useAsyncData`**, donc une seule fois, côté serveur au premier affichage : le HTML et le cookie renvoyés sont déjà à jour, sans décalage à l'hydratation.

Alternative rejetée : `GET /products?limit=0` (tout le catalogue en un appel) pour éviter N requêtes. Plus simple, mais on télécharge 194 produits pour en afficher 3. Le panier est limité à 30 lignes, et les appels partent en parallèle.

### « Détail ligne à ligne de chaque remise avec sa raison »

- Dans le récapitulatif, chaque remise a sa ligne, son montant et une phrase qui explique pourquoi elle s'applique (`discountReason`). Quand le code est plafonné, la phrase le dit : « Code réduit à 8,99 € : le total des remises est limité à 25 % du montant brut. »
- Sur chaque ligne beauté, la part de la remise beauté est affichée (`lineBeautyDiscountCents`). `computeCart` arrondit ligne par ligne, donc la somme des parts est **exactement** la remise du récapitulatif : un test le vérifie avec des lignes à 0,05 €, où un arrondi global donnerait un centime d'écart.
- En bonus, « Plus que X € pour la livraison offerte » (sauf avec un produit furniture, qui ne l'a jamais).

Exemple (scénario 2 du sujet, 3 × beauté à 19,99 €, code TROYES10) :

| Ligne du récapitulatif | Montant | Raison affichée                                                                |
| ---------------------- | ------- | ------------------------------------------------------------------------------ |
| Montant brut           | 59,97 € |                                                                                |
| Remise beauté          | -6,00 € | -10 % sur chaque article beauté, dès 3 articles beauté dans le panier.         |
| Code TROYES10          | -8,99 € | Code réduit à 8,99 € : le total des remises est limité à 25 % du montant brut. |
| Livraison              | 4,90 €  | Plus que 35,02 € pour la livraison offerte.                                    |
| Total                  | 49,88 € |                                                                                |

### Accessibilité (clavier et lecteur d'écran)

- Quantité : bouton −, champ numérique avec un label (« Quantité de Mascara », masqué visuellement), bouton +. Les boutons ont un nom explicite (« Ajouter un exemplaire de Mascara »).
- **Boutons jamais désactivés** : un bouton `disabled` perd le focus, et l'utilisateur clavier se retrouve en haut de la page. À la place, le store refuse (sous 1, au-delà du stock) et la zone `role="status"` explique pourquoi.
- Champ quantité : la valeur est validée au `change` (Entrée ou sortie du champ), pas à chaque frappe. Une valeur refusée est remplacée par la vraie quantité.
- « Retirer » : le texte lu est « Retirer Mascara du panier ». Après suppression, le bouton disparaît, donc le focus est replacé sur le titre `<h1>` et la suppression est annoncée.
- Code promo : `<label>`, `aria-invalid` si refusé, `aria-describedby` vers la zone de messages `role="alert"`, présente dès le départ pour être annoncée.
- Récapitulatif en `<dl>` : chaque montant est lu avec son intitulé.

### Tests

- `tests/unit/cart.spec.ts` : `syncCartWithProducts` (rien n'a changé, prix, stock réduit, rupture, produit non rechargé).
- `tests/unit/cartDetails.spec.ts` : raisons des remises (code plein, code plafonné du scénario 2), somme des parts beauté égale à la remise, montant manquant pour la livraison offerte.
- Les composants ne sont pas testés automatiquement : ils ne font qu'afficher. Testé à la main : voir la PR.
