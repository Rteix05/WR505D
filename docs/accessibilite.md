# Accessibilité : tunnel d'achat au clavier et audit Lighthouse (#58)

Barème : « Lighthouse accessibilité ≥ 95 sur les pages listées ; parcours clavier du tunnel sans blocage ». Chaque page avait déjà ses tests (axe-core, clavier page par page). Il manquait deux choses : le tunnel **en entier** au clavier seul, et l'audit Lighthouse lui-même.

## 1. Le parcours clavier (`e2e/tunnel-clavier.spec.ts`)

Accueil → « Produits » → tri « Prix décroissant » → « Appliquer » → premier produit → « Ajouter au panier » → « Voir le panier » → « + » (quantité 1 → 2) → code promo `troyes10` + Entrée → récapitulatif (-10,00 €, livraison offerte).

- **Aucun clic, même simulé** : seulement Tab, Entrée, les flèches et la saisie. `locator.click()` ou `focus()` atteindraient un élément que la tabulation ne peut pas atteindre, et le test ne prouverait plus rien.
- **`tabTo(page, cible)`** appuie sur Tab jusqu'à ce que la cible ait le focus, 60 fois au plus. Au-delà, le test échoue et affiche l'élément qui a le focus. Les deux défauts possibles sont ainsi détectés : un élément inatteignable (`tabindex="-1"`, `div` cliquable) et un ordre de tabulation aberrant (60 touches pour un bouton, c'est un blocage pour un utilisateur).
- **Tri aux flèches** : sur un `<select>` fermé, ArrowDown change la valeur sans ouvrir la liste. Le test vérifie que l'URL ne change **pas** avant « Appliquer » : sinon chaque flèche rechargerait le catalogue (WCAG 3.2.2, choix expliqué dans `docs/catalogue-url.md`).
- **Annonces vérifiées** : la confirmation « a été ajouté au panier » est lue dans un `role="status"`, ce qu'entend un lecteur d'écran.
- **Hydratation attendue** avant chaque touche, comme dans `comparer.spec.ts` : le HTML du serveur s'affiche avant que les boutons réagissent.
- **Étape 10** : axe-core (WCAG 2.1 AA) sur le panier **rempli**, avec la remise affichée. C'est le seul endroit où cet état est contrôlé ; le tableau `PAGES` de `accessibilite.spec.ts` contrôle désormais aussi `/panier` vide.

Résultat : le parcours passe sans aucun blocage (aucune correction de l'application nécessaire).

## 2. Audit Lighthouse

Lighthouse 13.5.0, catégorie accessibilité, sur le build de production (`node .output/server/index.mjs`), le 16/10/2026. Panier rempli (2 produits, code `TROYES10`), sélection du comparateur remplie et utilisateur `emilys` connecté, pour auditer les pages dans leur état le plus chargé. `/connexion` est auditée déconnectée (connecté, elle redirige vers l'accueil).

| Page          | URL                   | Score |
| ------------- | --------------------- | ----- |
| Accueil       | `/`                   | 100   |
| Catalogue     | `/produits`           | 100   |
| Fiche produit | `/produits/1`         | 100   |
| Panier        | `/panier`             | 100   |
| Connexion     | `/connexion`          | 100   |
| Mon compte    | `/compte`             | 100   |
| Comparateur   | `/comparer?ids=1,2,3` | 100   |

Les rapports HTML sont joints à la PR, pas commités : ils datent d'un build et seraient vite faux.

**Pourquoi 100 sans correction** : Lighthouse utilise axe-core, déjà lancé en CI sur chaque page depuis la semaine 1 (`accessibilite.spec.ts`). Les défauts qu'il détecte (contraste, labels, noms accessibles, titres) étaient donc bloqués dès leur apparition.

## 3. Défauts trouvés et corrigés

1. **Tests lancés contre une autre application** : `playwright.config.ts` réutilise un serveur déjà présent sur le port 3100 (`reuseExistingServer`). Sur un poste où une autre application occupe ce port, tous les tests échouaient sur sa page « Accès réservé », sans rapport avec ChampaShop. Le port se change maintenant avec `E2E_PORT` (`E2E_PORT=3200 npm run test:e2e`), 3100 par défaut, la CI ne change pas.
2. **Panier jamais contrôlé par axe-core**, ni vide ni rempli, alors que c'est la fin du tunnel : ajouté (voir § 1).

## 4. Alternatives écartées

- **Lighthouse CI dans le pipeline** (`@lhci/cli`) : même moteur qu'axe-core, déjà en CI, pour plus d'une minute de plus par PR. Le score dépend aussi des réponses de DummyJSON au moment de l'audit. axe-core, qui échoue à la première violation, est un garde-fou plus strict qu'un seuil à 95.
- **Parcours clavier avec `focus()` sur chaque élément** : plus court et plus stable, mais il ne prouve pas que l'élément est atteignable par tabulation, qui est justement le critère.

## 5. Limites

- Lighthouse et axe ne détectent qu'une partie des problèmes : ni la pertinence d'une annonce, ni la clarté d'un libellé. D'où le parcours clavier et les annonces vérifiées dans les tests.
- Testé avec Chromium seulement. Sur Safari macOS, Tab n'atteint pas les liens par défaut : c'est un réglage du navigateur (Option + Tab), pas un défaut du site.
- Pas de test avec un vrai lecteur d'écran (NVDA, VoiceOver).
