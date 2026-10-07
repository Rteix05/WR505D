# Comparateur (F6) : choix techniques

## 1. Logique pure (#44)

Fichiers : `utils/compare.ts`, `tests/unit/compare.spec.ts`. Les deux signatures imposées par le sujet sont respectées :

```ts
export function parseCompareIds(raw: unknown, max = 3): number[]
export function toggleCompare(
  ids: number[],
  id: number,
  max = 3,
): { ids: number[]; rejected: boolean }
```

Deux fonctions utilitaires s'y ajoutent : `formatCompareIds` (valeur canonique de l'URL) et `isSameCompareSelection` (la sélection du cookie diffère-t-elle de celle d'un lien reçu ?). Constantes : `COMPARE_MAX = 3`, `COMPARE_COOKIE = 'compare'`.

### `parseCompareIds` : une seule lecture pour l'URL et le cookie

La même sélection arrive sous trois formes, toutes acceptées :

| Source                                        | Valeur reçue     |
| --------------------------------------------- | ---------------- |
| URL `?ids=3,17,42`                            | `"3,17,42"`      |
| URL avec paramètre répété `?ids=3,17&ids=42`  | `["3,17", "42"]` |
| Cookie `compare` relu en JSON par `useCookie` | `[3, 17, 42]`    |

Une seule fonction pour les deux sources garantit que la page (#47) et la sélection (#46) appliquent exactement les mêmes règles. Le paramètre est `unknown` : l'URL et le cookie viennent du navigateur, chaque valeur est vérifiée (narrowing), sans `any`.

Règles, dans cet ordre :

1. **Identifiant valide** = entier strictement positif. Une chaîne doit être écrite en chiffres uniquement (`/^\d+$/`, espaces autour tolérés) : `"1.5"`, `"-1"`, `"1e3"`, `"abc"`, `"0"` sont refusés. `Number("1e3")` vaudrait 1000 et `Number("")` vaudrait 0 : on ne laisse pas `Number` décider seul. Un nombre trop grand pour être exact (`Number.isSafeInteger`) est refusé.
2. **Doublons ignorés**, la première occurrence garde sa place : `"3,17,3"` → `[3, 17]`.
3. **Ordre conservé** : c'est l'ordre des colonnes du tableau.
4. **Au plus `max`**, comptés **après** le tri des invalides et des doublons : `"abc,1,1,2,3,4"` → `[1, 2, 3]`. Un identifiant invalide ne prend pas la place d'un valide.

La fonction ne lève jamais d'erreur : `null`, un objet ou un booléen donnent une sélection vide. C'est la condition pour l'exigence « aucune erreur 500 » de la page.

Les identifiants **inexistants** (`?ids=999999`) ne peuvent pas être détectés ici, sans appel réseau : la page les retire après le chargement (#47).

### `toggleCompare` : ajouter ou retirer

| Situation                   | Résultat                               |
| --------------------------- | -------------------------------------- |
| Produit absent, place libre | ajouté en fin, `rejected: false`       |
| Produit présent             | retiré, ordre des autres conservé      |
| Produit absent, 3 produits  | sélection inchangée, `rejected: true`  |
| Identifiant invalide        | sélection inchangée, `rejected: false` |

- **Retirer est toujours possible**, même comparateur plein : le test du « présent » passe avant celui du maximum.
- **`rejected` ne veut dire qu'une chose** : « comparateur plein ». C'est lui qui déclenchera l'annonce « Comparateur plein : retirez un produit pour en ajouter un autre ». Un identifiant invalide (bug d'appel) ne doit pas afficher ce message, qui serait faux.
- Fonction pure : le tableau reçu n'est jamais modifié, un nouveau tableau est renvoyé (le store et l'URL comparent les valeurs).

### `formatCompareIds` : une URL canonique

`[3, 17, 42]` → `"3,17,42"`, et `null` pour une sélection vide (la page est alors `/comparer`, sans paramètre). La page compare la valeur brute de `?ids=` à cette valeur canonique : si elles diffèrent (`?ids=3,,abc,3`), elle normalise l'URL avec `navigateTo(…, { replace: true })`. Même principe qu'au catalogue (#4) : une sélection = une seule URL. Un test vérifie l'aller-retour `parseCompareIds(formatCompareIds(ids))`.

### `isSameCompareSelection` : l'ordre ne compte pas

Le sujet impose de proposer « Remplacer ma sélection par celle-ci » quand le lien reçu diffère du cookie. Les mêmes produits dans un autre ordre ne sont **pas** une autre sélection : on ne propose rien dans ce cas.

### Tests

38 tests, couverture complète de `utils/compare.ts`. Tous les cas demandés par le sujet : doublons (`"5,5,5"`), ordre, dépassement du maximum, entrées invalides (`"abc"`, `"1,,2"`, tableau vide, `null`), plus `"-1"`, `"1.5"`, `"1e3"`, `"0"`, nombre trop grand, espaces, paramètre répété, cookie en tableau de nombres, aller-retour URL, retrait quand le comparateur est plein, tableau d'entrée jamais modifié.
