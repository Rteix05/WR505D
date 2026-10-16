# Commande et paiement simulé (#65)

Bug signalé : « Une fois le panier validé je ne peux pas payer ». Comportement attendu : une page de coordonnées ou de paiement simulé. Le sujet ne détaille pas cette page (il s'arrête au récapitulatif de `/panier`), les choix ci-dessous sont donc les nôtres.

## 1. Le parcours

`/panier` → « Valider ma commande » → (connexion si besoin) → `/commande` : coordonnées + paiement simulé → `/commande/confirmation?numero=209`, panier vidé.

## 2. Choix et raisons

| Choix                                                      | Pourquoi                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commande enregistrée avec `POST /carts/add` (DummyJSON)    | Le sujet cite DummyJSON « produits, authentification, **paniers** ». La route renvoie un `id` qui sert de numéro de commande. DummyJSON n'enregistre rien : **le numéro est toujours 209**, pour tout le monde (vérifié avec trois `curl` de suite). La confirmation dit donc « Commande n° 209 simulée », jamais « enregistrée ». |
| `/commande` réservée aux connectés (middleware `auth`)     | `/carts/add` exige un `userId` (sans lui : 400 « User id is required »). Le middleware existant renvoie vers `/connexion?redirect=/commande` puis ramène ici : rien à réécrire. Le panier, en cookie, survit à la connexion.                                                                                                       |
| `$authFetch` et pas `useApi()`                             | Règle de l'équipe : les paniers DummyJSON passent par le client authentifié (`utils/dummyjsonApi.ts`). La page est protégée, il y a toujours un jeton ; s'il a expiré, retour à la connexion.                                                                                                                                      |
| **Aucun champ de carte bancaire**                          | Le paiement est simulé : demander un numéro de carte, même factice, habituerait à en saisir un vrai sur un site d'exercice, et le ferait transiter vers une API publique. Un texte l'annonce : « aucune donnée bancaire n'est demandée et rien n'est débité ».                                                                     |
| Total affiché = notre `computeCart`                        | DummyJSON calcule son propre `discountedTotal` avec ses remises à lui, qui n'ont rien à voir avec nos promotions. Le bouton dit « Payer 36,37 € », le montant du récapitulatif.                                                                                                                                                    |
| Coordonnées pré-remplies (nom, e-mail du profil)           | L'utilisateur connecté n'a plus que l'adresse à saisir. `autocomplete` standard (`name`, `street-address`, `postal-code`…) pour le remplissage du navigateur (WCAG 1.3.5).                                                                                                                                                         |
| Validation dans `utils/checkout.ts` (fonctions pures)      | Testée sans navigateur. Le code postal accepte « 10 000 » (espaces retirés) mais exige 5 chiffres ; l'e-mail une forme `x@y.z`, pas plus : une regex « complète » refuse des adresses valides.                                                                                                                                     |
| Confirmation sur une URL (`?numero=`)                      | Rechargeable et rendue par le serveur. Numéro invalide (`abc`, `0`, `01`…) : vraie 404, comme une fiche produit inexistante. Pas besoin de la protéger : elle n'affiche que le numéro, rien de personnel.                                                                                                                          |
| Panier vidé **après** la navigation, gardé en cas d'erreur | Vidé avant, la page afficherait « panier vide » le temps de partir. En cas d'échec de l'API, le panier et les champs restent : on réessaie sans rien ressaisir.                                                                                                                                                                    |

## 3. Accessibilité

- Champs regroupés dans des `fieldset`/`legend`, un `label` par champ, « Tous les champs sont obligatoires » écrit en clair.
- Erreurs : `aria-invalid` et `aria-describedby` sur le champ, focus sur le premier champ en erreur ; erreur de l'API dans un `role="alert"` présent dès le chargement (sinon il n'est pas annoncé), comme sur `/connexion`.
- « Valider ma commande » est un lien (il mène à une page, fonctionne sans JavaScript), « Payer » un bouton relié à la mention du paiement simulé (`aria-describedby`).
- axe-core sans violation sur `/commande` et la confirmation (`e2e/commande.spec.ts`).

## 4. Cas limites

| Cas                                    | Comportement                                                            |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Panier vide sur `/commande`            | « Votre panier est vide : il n'y a rien à commander. » + lien catalogue |
| Double clic sur « Payer »              | Bouton désactivé pendant l'envoi, une seule commande                    |
| API indisponible (5xx) ou réseau coupé | Message annoncé, panier et coordonnées gardés                           |
| Jeton expiré pendant la commande       | Retour à `/connexion?redirect=/commande`, panier gardé                  |
| Retour arrière après la confirmation   | `/commande` avec un panier vide : la commande n'est pas repassée        |
| `?numero=abc`, `0`, `-3`, vide         | 404 « Commande introuvable »                                            |

## 5. Tests

- `tests/unit/checkout.spec.ts` : chaque message d'erreur, normalisation, limites de longueur, numéro de commande, corps de la requête, message d'erreur de l'API.
- `e2e/commande.spec.ts` : parcours complet (connexion par la redirection, pré-remplissage, paiement, confirmation, panier vidé, retour arrière), erreurs de saisie (rien n'est envoyé), clavier seul, API en panne (réponse simulée par `page.route`), 404, sans JavaScript, axe-core.

## 6. Limites

- Le formulaire de commande demande JavaScript (l'envoi passe par `$authFetch`). Sans JavaScript, le panier et la confirmation s'affichent et le lien mène à la connexion, mais on ne peut pas payer. Une route serveur Nitro le permettrait ; écartée pour une simulation.
- DummyJSON ne garde pas les paniers créés : la commande n'apparaît pas dans `/compte`, et le numéro (209) est le même pour toutes les commandes. Une vraie boutique le générerait côté serveur.

## 7. Suites de la review de #70 (Marwan)

- **« enregistrée » → « simulée »** : le numéro est toujours 209 et rien n'est gardé, la page le dit maintenant (« Rien n'a été débité ni enregistré : DummyJSON simule la commande et renvoie toujours le même numéro »). Test e2e adapté.
- **Changements de prix et de stock affichés sur `/commande`** : `useCartProducts()` relisait déjà les produits, mais seul `/panier` affichait ses messages. Un prix changé ou un produit retiré se voit maintenant au-dessus du formulaire, **avant** de payer, et le bouton « Payer » affiche le nouveau total. Test e2e : mascara mis au panier à 5,00 €, l'API le vend 9,99 € → « Le prix de « Essence Mascara Lash Princess » a changé : 5,00 € → 9,99 € » et « Payer 14,89 € ».
- **Couleurs sur le socle du design (#71)** : plus aucune couleur en dur dans `/commande` ni dans le lien « Valider ma commande » (classe `.btn` et variables `--color-*`). Champs à `--touch-target` (44 px).
