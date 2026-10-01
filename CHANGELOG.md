# Changelog

Toutes les évolutions notables de ChampaShop. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [0.1.0] - 2026-10-01

Première version : catalogue, fiche produit, panier avec moteur de promotions et authentification DummyJSON.

### Ajouté

**F1. Catalogue `/produits`**

- Liste paginée de 12 produits avec image, titre, prix, note et badge « −X % » ; pagination par liens, fonctionnelle sans JavaScript (#2, PR #24).
- Recherche plein texte avec debounce de 300 ms ; la requête précédente est annulée, une réponse ancienne n'écrase jamais une plus récente ; fonctionne sans JavaScript (#3, PR #37).
- Filtre par catégorie et tri par prix, note ou titre, formulaire accessible utilisable sans JavaScript (#4, PR #22).
- Filtre prix min / max : un seul appel avec les champs utiles, filtrage et pagination locale avec un total exact, stratégie justifiée dans le README (#5, PR #38).
- L'URL est la source de vérité : page, recherche, catégorie, tri et prix dans les query params ; rechargement, bouton retour et lien partagé donnent la même vue, rendue côté serveur (#4, PR #22).
- États chargement (squelettes), aucun résultat et erreur réseau avec « Réessayer » (#2, PR #24).

**F2. Fiche produit `/produits/[id]`**

- Galerie accessible, description, marque, note, stock, garantie et livraison ; « Plus que X en stock » et rupture ; ajout au panier ; vraie 404 pour un identifiant invalide ou inexistant ; `useSeoMeta` avec image et canonical (#6, PR #36).
- Page d'erreur globale en français (`error.vue`), utilisable sans JavaScript (#6, PR #36).

**F3. Panier**

- Store Pinia persisté en cookie compact (< 4 Ko), stock jamais dépassé (#8, PR #29).
- Page `/panier` : quantités au clavier, code promo, détail et raison de chaque remise, resynchronisation des prix et du stock avec l'API (#9, PR #30).

**F4. Moteur de promotions**

- `computeCart` : remise beauté, code TROYES10, plafond de 25 %, livraison ; les 8 scénarios du sujet testés, couverture 100 % (#7, PR #15).

**F5. Authentification**

- Page `/connexion` accessible, jetons en cookies, utilisateur chargé côté serveur sans flash, redirection sûre (#10, PR #16).
- Rafraîchissement du jeton en single-flight (#12, PR #17).
- Middleware `auth`, page `/compte` et déconnexion (#11, PR #31).
- Store Pinia `auth` (séance 7) et nom d'utilisateur mémorisé avec `pinia-plugin-persistedstate` (#32, PR #33).

**Base technique**

- Types DummyJSON écrits depuis les réponses réelles et client API des routes publiques (#1, PR #23).
- Tests de bout en bout Playwright et contrôle d'accessibilité axe (WCAG 2.1 AA) en CI (#27, PR #28).
- Consignes communes pour l'équipe et l'IA, guide GitFlow, procédure de release et de hotfix (`CLAUDE.md`, `AGENTS.md`) (#18, #20, #39, PR #19, #21, #40).

### Modifié

- Une seule déconnexion, celle du store `auth` (#34, PR #35).

### Corrigé

- Suites des reviews : message du plafond de remise, `safeRedirect` (toutes les formes de `/connexion`), type de `role` (#25, PR #26).

[0.1.0]: https://github.com/Rteix05/WR505D/releases/tag/v0.1.0
