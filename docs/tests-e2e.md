# Tests de bout en bout (Playwright) : choix techniques

Issue #27. Fichiers : `playwright.config.ts`, `e2e/catalogue.spec.ts`, `e2e/connexion.spec.ts`, `e2e/accessibilite.spec.ts`, job `e2e` de `.github/workflows/ci.yml`.

## 1. Ce que Playwright vérifie que Vitest ne peut pas

Vitest teste des fonctions pures et des composants isolés. Playwright ouvre un vrai navigateur (Chromium) sur le site complet : rendu serveur, routeur, cookies, clavier, bouton retour, JavaScript désactivé. C'est le seul moyen de vérifier automatiquement les exigences du sujet comme « rechargement, bouton retour et lien partagé reproduisent la même vue » ou « pas de flash de l'état déconnecté ».

## 2. Sur le build de production

`webServer` lance `node .output/server/index.mjs`, le même serveur que celui déployé, plutôt que `npm run dev` :

- le rendu serveur et les bundles sont ceux que verront les visiteurs ;
- les cookies sont `secure` comme en production (en dev ils ne le sont pas) ;
- pas de compilation à la volée, donc des temps de réponse stables.

En CI, le build est fait par l'étape précédente du job ; en local, la commande le refait (`npm run build && …`). `reuseExistingServer` réutilise un serveur déjà lancé en local.

## 3. La vraie API DummyJSON, pas de faux

Les pages chargent leurs données **côté serveur** (Nuxt appelle DummyJSON avant d'envoyer le HTML). `page.route()` de Playwright n'intercepte que les requêtes du navigateur : il ne verrait pas ces appels. Simuler l'API demanderait un faux serveur DummyJSON, lourd à maintenir pour une API de démonstration stable.

Conséquences assumées :

- `retries: 2` en CI : une relance absorbe un aléa réseau ;
- les tests n'utilisent pas de valeurs fragiles : `/^\d+ produits, page 1 sur \d+$/` plutôt que « 194 produits ».

## 4. Trouver les éléments comme un utilisateur

Les sélecteurs sont des rôles et des libellés (`getByRole('navigation', { name: 'Pagination' })`, `getByLabel('Mot de passe')`), jamais des classes CSS :

- les tests ne cassent pas quand on renomme une classe ;
- un élément introuvable par son rôle est souvent inaccessible : le test sert aussi de contrôle d'accessibilité.

Deux pièges rencontrés, notés dans `CLAUDE.md` :

- « Page 1 » correspondait aussi à « Page 17 » : `{ exact: true }` ;
- deux `role="alert"` sur la page : celui du formulaire et celui de `<NuxtRouteAnnouncer>` (annonce des changements de page) → recherche limitée au `<main>`.

## 5. Parcours couverts

| Fichier                 | Parcours                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalogue.spec.ts`     | 12 produits avec prix et note ; page suivante puis bouton retour ; clavier (Entrée sur « Suivante », focus sur le titre) ; `?page=abc` ; page hors bornes ; sans JavaScript (liste et pagination)                                     |
| `connexion.spec.ts`     | Formulaire vide (focus, `aria-invalid`, description accessible) ; mauvais mot de passe ; connexion puis page sans JavaScript avec les mêmes cookies (pas de flash) ; `?redirect=` interne et externe                                  |
| `filtres.spec.ts`       | Catégorie + tri (ordre des prix vérifié) ; rien avant « Appliquer » ; Entrée au clavier ; bouton retour ; retour page 1 ; « Effacer les filtres » ; catégorie inconnue ; formulaire **sans JavaScript** redirigé vers l'URL canonique |
| `accessibilite.spec.ts` | axe-core, WCAG 2.1 A et AA, sur `/`, `/produits`, `/produits?page=2`, `/produits?category=beauty&sortBy=price&order=desc`, `/connexion` : zéro violation                                                                              |

**Pas de flash, vérifié sans ambiguïté** : après la connexion, on ouvre un second contexte avec les mêmes cookies et **JavaScript désactivé**. Seul le HTML du serveur s'affiche : s'il contient « Bonjour, Emily » et aucun lien « Connexion », l'état connecté est bien rendu côté serveur.

## 6. Accessibilité automatique

`@axe-core/playwright` utilise axe-core, le moteur de l'audit accessibilité de Lighthouse (barème : ≥ 95). Le test échoue à la moindre violation WCAG 2.1 AA et affiche la règle et les éléments concernés. Il ne remplace pas un parcours au clavier (d'où les tests clavier), mais bloque les régressions détectables : contraste, labels, noms accessibles, structure des titres.

## 7. En CI

Job séparé « E2E Playwright » : il tourne en parallèle du job existant, et un échec indique tout de suite si c'est un parcours ou le lint qui casse. Le rapport HTML (captures et traces des échecs) est publié en artefact pendant 7 jours.

## 8. Pour ajouter un parcours

Voir la section « Tests de bout en bout (Playwright) » de `CLAUDE.md` : un fichier par fonctionnalité, rôles plutôt que classes, clavier, retour arrière, URL invalide, sans JavaScript, et la page ajoutée au contrôle d'accessibilité.
