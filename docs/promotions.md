# Moteur de promotions : choix techniques

Issue #7. Fichiers : `utils/promotions.ts`, `utils/price.ts`, `types/promotions.ts`, `tests/unit/promotions.spec.ts`.

## 1. Pourquoi une fonction pure dans `utils/`

`computeCart(lines, promoCode?)` ne dépend ni de Vue, ni de Pinia, ni de l'API : elle reçoit des données, renvoie un résultat, et ne modifie rien (les lignes reçues ne sont jamais modifiées, un test le vérifie).

- **Testable** : on la teste avec Vitest en environnement Node, sans monter de composant ni simuler de store.
- **Réutilisable** : le store panier (#8) l'appelle, la page `/panier` (#9) affiche son résultat. Si un jour les promotions passent côté serveur (ce que le sujet recommande en production), la fonction peut être déplacée telle quelle dans `server/`.
- **Responsabilité unique (SOLID)** : le calcul est séparé de l'état (store) et de l'affichage (composants).

## 2. Pourquoi les montants en centimes entiers

En JavaScript, `0.1 + 0.2 === 0.30000000000000004`. Sur des prix, ces erreurs finissent par décaler un total d'un centime. En travaillant en centimes entiers (`1999` au lieu de `19.99`), additions et multiplications restent exactes.

- `toCents(price)` convertit le prix DummyJSON une seule fois, à l'entrée : `Math.round(19.99 * 100)` donne `1999` (le `Math.round` corrige le `1998.9999…` que donnerait la multiplication seule).
- `formatCents(cents)` ne sert qu'à l'affichage (`Intl.NumberFormat` en `fr-FR`, donne « 19,99 € »).

## 3. L'arrondi demi vers le haut : `percentOfCents`

```ts
Math.floor((amountCents * percent + 50) / 100)
```

On veut `amountCents × percent / 100` arrondi au centime, avec 0,5 arrondi vers le haut (arrondi commercial). Ajouter `50` avant de diviser par `100` puis tronquer revient exactement à ça, et tout le calcul reste en entiers.

Exemple : 3 × 6,65 € = 1995 centimes, 10 % = 199,5 centimes.
`(1995 × 10 + 50) / 100 = 200` : on obtient bien 2,00 €.

Pourquoi pas `Math.round(amount * 0.1)` ? Parce que `0.1` n'est pas exact en binaire : le résultat peut tomber sur `199.49999…` et s'arrondir dans le mauvais sens.

## 4. Une fonction par règle (principe ouvert / fermé)

Chaque règle du sujet est une fonction exportée, appelée dans l'ordre imposé par `computeCart` :

| Ordre | Fonction            | Rôle                                                   |
| ----- | ------------------- | ------------------------------------------------------ |
| 1     | `beautyDiscount`    | -10 % par ligne beauty dès 3 articles beauty           |
| 2     | `promoCodeDiscount` | Code TROYES10, ou message expliquant le refus          |
| 3     | `applyDiscountCap`  | Remises limitées à 25 % du brut, en réduisant le code  |
| 4     | `computeShipping`   | 4,90 €, offerte dès 80 € après remises, sauf furniture |

- Chaque règle est lisible et testable seule.
- Ajouter une règle (ex. un nouveau code) = écrire une nouvelle fonction et l'appeler dans `computeCart`, sans toucher aux autres.
- Toutes les valeurs métier (10 %, 50 €, 25 %, 4,90 €, 80 €…) sont des constantes nommées en haut du fichier : un changement de règle commerciale se fait à un seul endroit.

`computeShipping` ne s'appelle pas `shippingCents` : Nuxt importe automatiquement les exports de `utils/` dans toute l'application, et ce nom aurait été confondu avec le champ `shippingCents` du récapitulatif.

## 5. Détail des règles

### Règle 1 : remise beauté

On compte les **articles** (quantités cumulées), pas les lignes : 1 ligne de 3 rouges à lèvres suffit. La remise est calculée **ligne par ligne**, chaque ligne arrondie séparément, comme l'impose le sujet. Cela peut donner un centime de différence avec un arrondi global (3 lignes à 0,05 € : 0,01 × 3 = 0,03 € au lieu de 0,02 €), un test le vérifie.

### Règle 2 : code TROYES10

- `promoCode?.trim().toUpperCase()` : insensible à la casse et aux espaces autour (scénario 7 : `" troyes10 "`).
- Le seuil porte sur le sous-total **après** la remise beauté, et il est **strictement** supérieur à 50 € : 50,00 € pile est refusé (scénario 6 et test dédié).
- Code vide ou uniquement des espaces : ignoré sans message (l'utilisateur n'a rien saisi).
- Code inconnu ou seuil non atteint : aucun rabais, mais un message dans `messages` pour que la page panier explique le refus.

La fonction renvoie `{ discount, message }` plutôt que de lever une erreur : un code refusé n'est pas une erreur du programme, c'est un cas métier normal.

### Règle 3 : plafond de 25 %

```
plafond = 25 % du brut (arrondi au centime)
dépassement = total des remises - plafond
si dépassement > 0 : code réduit de ce dépassement
```

Le sujet précise que c'est le code qui est réduit, jamais la remise beauté. La remise beauté (10 %) ne peut de toute façon pas dépasser seule le plafond (25 %). Un message informe l'utilisateur que son code a été limité.

Suite à la review de #15 (Marwan) : la fonction ne suppose plus que le dépassement vient forcément du code. Si une autre remise dépassait un jour le plafond :

- sans code promo, rien n'est réduit et aucun message n'est affiché (un message « code limité » serait faux) ;
- si le dépassement est plus grand que le code, le code est retiré et le message dit « ne s'applique pas » au lieu de « limité à 0,00 € ».

Deux tests appellent `applyDiscountCap` directement avec une remise fictive de 30 % pour vérifier ces cas, impossibles avec les règles actuelles.

Vérification du scénario 2 (3 × beauty à 19,99 €, TROYES10) :

| Étape              | Calcul                          | Résultat |
| ------------------ | ------------------------------- | -------- |
| Brut               | 3 × 19,99                       | 59,97 €  |
| Remise beauté      | 10 % de 59,97 = 5,997 → arrondi | -6,00 €  |
| Sous-total         | 59,97 - 6,00 = 53,97 > 50       | code OK  |
| Plafond            | 25 % de 59,97 = 14,9925 → 14,99 |          |
| Dépassement        | 6,00 + 10,00 - 14,99 = 1,01     |          |
| Code réduit        | 10,00 - 1,01                    | -8,99 €  |
| Après remises      | 59,97 - 6,00 - 8,99 = 44,98     |          |
| Livraison (< 80 €) |                                 | 4,90 €   |
| **Total**          |                                 | 49,88 €  |

### Règle 4 : livraison

Calculée sur le montant **après** remises : 90 € - 10 € de code = 80 € pile, donc livraison offerte (scénario 5). Un seul produit `furniture` dans le panier rend la livraison toujours payante (scénario 4).

## 6. Choix pour les cas non prévus par le sujet

| Cas                                | Choix           | Raison                                                                                   |
| ---------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| Panier vide                        | Livraison à 0 € | Facturer 4,90 € pour ne rien livrer n'a pas de sens                                      |
| Quantité à 0, négative ou décimale | Ligne ignorée   | Données invalides : elles ne doivent ni coûter ni déclencher de remise                   |
| Prix négatif ou non entier         | Ligne ignorée   | Un prix négatif ferait baisser le total, un prix décimal casserait le calcul en centimes |

Ignorer plutôt que lever une erreur : le store panier (#8) empêche déjà ces cas, cette vérification est un filet de sécurité, et l'affichage du panier ne doit pas planter.

## 7. Les types dans `types/promotions.ts`

La signature (`CartLine`, `AppliedDiscount`, `CartSummary`) est imposée par le sujet. Les types sont déclarés dans `types/` (règle du template de PR) puis réexportés depuis `utils/promotions.ts`, pour qu'on puisse aussi les importer depuis le moteur comme dans l'énoncé.

`DiscountId = 'BEAUTY_3' | 'TROYES10'` est une union de littéraux : TypeScript refuse tout autre identifiant de remise, ce qui évite les fautes de frappe.

## 8. Stratégie de tests

- Les 8 scénarios du sujet sont reproduits tels quels. La fonction `row()` du test met le résultat sous la forme du tableau de l'énoncé (brut, beauté, code, livraison, total), ce qui rend la comparaison directe.
- Les cas limites ciblent les frontières : 50,00 € refusé / 50,01 € accepté, livraison à 79,99 € / 80,00 €, 2 articles beauté contre 3, arrondi à 0,5 centime.
- Couverture : 100 % des lignes et branches de `utils/promotions.ts` (seuil CI à 90 %).
