#!/usr/bin/env bash
# Crée les labels, le milestone « Semaine 1 » et les issues de la semaine 1.
# Prérequis : GitHub CLI installé et connecté (gh auth login).
# Usage : bash scripts/github-setup.sh
set -euo pipefail

REPO="Rteix05/WR505D"
MILESTONE="Semaine 1"
ISSUES_DIR="$(dirname "$0")/issues"

echo "==> Labels"
gh label create feature  --repo "$REPO" --color 1D76DB --description "Nouvelle fonctionnalité" --force
gh label create bug      --repo "$REPO" --color D73A4A --description "Bug détecté en développement" --force
gh label create bug-prod --repo "$REPO" --color B60205 --description "Bug en production (hotfix)" --force
gh label create a11y     --repo "$REPO" --color 5319E7 --description "Accessibilité" --force
gh label create test     --repo "$REPO" --color 0E8A16 --description "Tests" --force

echo "==> Milestone"
if ! gh api "repos/$REPO/milestones?state=all" --jq '.[].title' | grep -qx "$MILESTONE"; then
  gh api "repos/$REPO/milestones" -f title="$MILESTONE" \
    -f description="Release v0.1.0 : catalogue, fiche produit, panier, promotions, authentification" >/dev/null
fi

echo "==> Issues"
# Chaque fichier scripts/issues/NN-*.md : ligne 1 = titre, ligne 2 = labels, puis le corps.
for file in "$ISSUES_DIR"/*.md; do
  title="$(sed -n '1p' "$file")"
  labels="$(sed -n '2p' "$file")"
  body="$(tail -n +4 "$file")"
  gh issue create --repo "$REPO" --title "$title" --label "$labels" --milestone "$MILESTONE" --body "$body"
done

echo "==> Terminé. Pensez à assigner chaque issue à UN seul membre de l'équipe."
