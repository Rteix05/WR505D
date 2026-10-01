# Fiche produit `/produits/[id]` : choix techniques

Issue #6. Fichiers : `pages/produits/[id].vue`, `components/product/ProductGallery.vue`, `error.vue`, `utils/productDetails.ts`, `types/productDetails.ts`, `tests/unit/productDetails.spec.ts`, `e2e/produit.spec.ts`.

## 1. Découpage

| Élément                   | Rôle                                                                            |
| ------------------------- | ------------------------------------------------------------------------------- |
| `pages/produits/[id].vue` | Charge le produit, gère la 404, le SEO et l'ajout au panier                     |
| `<ProductGallery>`        | Image principale + miniatures cliquables                                        |
| `utils/productDetails.ts` | Fonctions pures testées : identifiant de l'URL, état du stock, meta description |
| `error.vue`               | Page d'erreur du site (404 et autres), en français, avec l'en-tête habituel     |

Réutilisé sans le réécrire : `useApi().getProduct` (#1), `discountBadge` et `formatRating` (#2), `toCents` / `formatCents`, le store `cart` (#8) et `httpStatusOf` (#10).

## 2. Une vraie 404

Deux cas, une seule réponse : **statut HTTP 404** + page « Produit introuvable ».

```
/produits/abc   → parseProductId refuse   → createError(404), sans appeler l'API
/produits/99999 → l'API répond 404        → createError(404)
/produits/12    → l'API répond 200        → fiche
l'API ne répond pas (réseau, 500)         → message + « Réessayer », pas une 404
```

- **Valider l'identifiant avant l'appel** (`parseProductId`, chiffres uniquement, entier ≥ 1) : `abc`, `0`, `-1`, `1.5` ou `1e3` ne coûtent pas une requête. DummyJSON répondrait aussi 404, mais autant ne pas lui envoyer n'importe quoi venant de l'URL.
- **`createError({ statusCode: 404, fatal: true })`** dans le `setup` : côté serveur, Nuxt renvoie le statut 404 avec `error.vue`. Les moteurs de recherche ne gardent donc pas une page vide en 200 (« soft 404 »). `fatal` affiche aussi la page d'erreur lors d'une navigation côté client.
- **Une erreur réseau n'est pas une 404** : le produit existe peut-être. On affiche « Impossible de charger ce produit » avec un bouton « Réessayer », comme le catalogue.
- **`error.vue`** : sans elle, Nuxt affiche sa page par défaut en anglais, sans l'en-tête du site. Elle est en `noindex`, et ses liens sont de simples `<a href>` : ils fonctionnent sans JavaScript, et le rechargement repart d'une application sans erreur (pas besoin de `clearError()`).

Vérifié sur le build de production : `/produits/99999`, `/produits/abc` et `/produits/0` répondent 404, avec le titre « Produit introuvable · ChampaShop ».

## 3. Le stock

| Stock | Affiché                 | Bouton « Ajouter au panier » |
| ----- | ----------------------- | ---------------------------- |
| 0     | « Rupture de stock »    | désactivé                    |
| 1 à 4 | « Plus que X en stock » | actif                        |
| ≥ 5   | « En stock »            | actif                        |

- **Basé sur `stock`, pas sur `availabilityStatus`** : vérifié sur les 194 produits, l'API renvoie parfois « Low Stock » avec 5 exemplaires ou plus. Le sujet parle du nombre (« stock < 5 »), on suit le nombre.
- **Le seuil est une constante** (`LOW_STOCK_THRESHOLD = 5`), testée à la limite : 4 → stock faible, 5 → en stock.
- **Bouton désactivé en rupture**, comme demandé par l'issue. Sur la page panier (#9), les boutons ne sont jamais désactivés, car un bouton qui devient `disabled` après un clic perd le focus. Ici, il l'est **dès l'affichage**, donc aucun focus n'est perdu. Il a un `aria-describedby` vers le texte du stock : un lecteur d'écran lit « Ajouter au panier, indisponible, Rupture de stock ».
- **Ajout au panier** : `cart.add()` borne au stock et renvoie un message s'il refuse (« Vous avez déjà les 4 exemplaires disponibles… »). Sinon, la page confirme (« « Mascara » a été ajouté au panier. »). Le message est dans une zone `role="status"`, toujours présente, donc annoncée. « Déjà X dans votre panier » rappelle ce qui y est déjà, avec un lien vers le panier.
- **`minimumOrderQuantity` ignoré** : l'API en donne un (48 pour le mascara), mais ni le sujet ni le panier (#8) ne le gèrent. Ajouter 1 exemplaire reste possible.

## 4. La galerie

- Image principale + miniatures. Les miniatures sont de **vrais `<button>`** : Tab, Entrée et Espace marchent sans code en plus.
- La miniature affichée a `aria-current="true"` (bordure foncée à l'écran). Chaque bouton a un nom : « Afficher l'image 2 sur 3 ».
- Le texte alternatif de l'image principale dit laquelle est affichée : « Dolce Shine Eau de, image 2 sur 3 ». Les miniatures ont `alt=""` : le nom du bouton suffit, sinon tout serait lu deux fois.
- **Une seule image** (78 produits sur 194) : pas de miniatures, une liste d'un seul bouton n'apporterait rien. **Aucune image** : on retombe sur `thumbnail`.
- Image principale en `fetchpriority="high"` (c'est le plus gros élément visible, le LCP), miniatures en `loading="lazy"`. `width` et `height` sont fixés : pas de décalage de mise en page au chargement.
- `definePageMeta({ key: route => route.fullPath })` : en passant d'un produit à un autre, la page est recréée. Sans ça, Vue réutiliserait le composant, et la galerie resterait sur l'image 3 d'un produit qui n'en a qu'une.

## 5. SEO

`useSeoMeta` avec titre (nom du produit), description, Open Graph (titre, description, image, texte alternatif de l'image, URL) et `twitter:card` en `summary_large_image`. Lien `canonical` vers `/produits/{id}`.

La meta description vient de `seoDescription` : espaces nettoyés, coupée à 160 caractères **sur un espace** (jamais au milieu d'un mot), sans ponctuation avant le « … ». Exemple avec une limite de 30 : « Lorem ipsum dolor sit amet, consectetur… » → « Lorem ipsum dolor sit amet… ».

Tout est rendu côté serveur (`useAsyncData`) : les robots et les aperçus de partage (qui n'exécutent pas JavaScript) voient le titre, la description et l'image.

## 6. Accessibilité

- Fil d'Ariane (`<nav aria-label="Fil d'Ariane">`, page courante en `aria-current="page"`).
- Note lue « Note : 4,6 sur 5 » (l'étoile est `aria-hidden`), remise lue « Remise de −10 % ».
- Garantie, livraison, retours en `<dl>` : chaque valeur est lue avec son intitulé.
- Couleurs du stock vérifiées par axe-core (contraste AA), et le texte dit toujours l'état : la couleur n'est jamais la seule information.
- Focus visible partout.

## 7. Tests

Automatiques, `tests/unit/productDetails.spec.ts` (21 tests) :

- `parseProductId` : 3 identifiants acceptés, 10 refusés (texte, 0, négatif, décimal, `1e3`, espaces, vide, trop grand, absent, tableau vide) ;
- `productStock` : 0 et négatif, 1 et 4 (stock faible), 5 et 99 (en stock) ;
- `seoDescription` : texte court, coupe sur un espace, ponctuation retirée, mot unique trop long, texte vide.

De bout en bout, `e2e/produit.spec.ts` (Playwright, build de production, vraie API) :

- fiche complète (titre, marque, note, prix, stock, description, garantie, livraison, meta description et `og:image`) ;
- depuis le catalogue, puis bouton retour ;
- galerie à la souris et au clavier ; pas de miniatures pour une seule image ;
- ajout au panier : message annoncé, badge « Panier, 1 article » ;
- stock faible (produit 9) : « Plus que 4 en stock », 5 appuis sur Entrée, message de limite, badge à 4 ;
- rupture (produit 117) : bouton désactivé, description accessible « Rupture de stock » ;
- `/produits/99999` et `/produits/abc` : statut 404, `noindex`, lien vers le catalogue ;
- sans JavaScript : fiche complète et 404 renvoyées par le serveur.

`e2e/accessibilite.spec.ts` : `/produits/9`, `/produits/117` et `/produits/99999` ajoutées (axe-core, zéro violation).

Les identifiants 1, 9 et 117 sont des données fixes de l'API de démonstration. Si DummyJSON les changeait, ces tests casseraient : c'est voulu, la CI le signalerait.
