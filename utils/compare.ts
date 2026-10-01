// Comparateur (F6) : fonctions pures, sans Vue ni Pinia. Utilisées par la page /comparer (#47)
// et par la sélection persistée dans le cookie `compare` (#46).

/** Nombre maximal de produits comparés (imposé par le sujet). */
export const COMPARE_MAX = 3

/** Nom du cookie de la sélection (imposé par le sujet). */
export const COMPARE_COOKIE = 'compare'

export interface CompareToggleResult {
  ids: number[]
  /** `true` si le produit n'a pas pu être ajouté parce que le comparateur est plein. */
  rejected: boolean
}

/** Identifiant DummyJSON : entier strictement positif. */
function isProductId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/**
 * Un élément brut → identifiant, ou `null`. Une chaîne doit être écrite en chiffres
 * uniquement (espaces autour tolérés) : `"1.5"`, `"-1"`, `"1e3"` ou `"abc"` sont refusés.
 */
function toProductId(value: unknown): number | null {
  if (isProductId(value)) return value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const id = Number(trimmed)
  return isProductId(id) ? id : null
}

/**
 * Aplatit les formes que peut prendre la valeur brute :
 * - `"3,17,42"` (URL ou cookie texte) ;
 * - `["3", "17"]` ou `["3,17", "42"]` (vue-router quand `?ids=` est répété) ;
 * - `[3, 17]` (cookie relu en JSON par `useCookie`).
 */
function rawItems(raw: unknown): unknown[] {
  const values = Array.isArray(raw) ? raw : [raw]
  return values.flatMap((value) => (typeof value === 'string' ? value.split(',') : [value]))
}

/**
 * Lit une sélection (`?ids=` ou cookie `compare`). Ne lève jamais d'erreur :
 * identifiants invalides et doublons ignorés, ordre conservé, au plus `max`.
 */
export function parseCompareIds(raw: unknown, max = COMPARE_MAX): number[] {
  const ids: number[] = []
  for (const item of rawItems(raw)) {
    if (ids.length >= max) break
    const id = toProductId(item)
    if (id !== null && !ids.includes(id)) ids.push(id)
  }
  return ids
}

/**
 * Ajoute ou retire un produit. Comparateur plein : rien n'est ajouté et `rejected` vaut `true`
 * (la page annonce alors « Comparateur plein… »). Retirer reste toujours possible.
 * Un identifiant invalide ne change rien et n'est pas un refus « plein ».
 */
export function toggleCompare(ids: number[], id: number, max = COMPARE_MAX): CompareToggleResult {
  if (ids.includes(id)) return { ids: ids.filter((current) => current !== id), rejected: false }
  if (!isProductId(id)) return { ids, rejected: false }
  if (ids.length >= max) return { ids, rejected: true }
  return { ids: [...ids, id], rejected: false }
}

/**
 * Valeur canonique de `?ids=` : `"3,17,42"`, ou `null` s'il n'y a rien à comparer
 * (l'URL canonique est alors `/comparer`, sans paramètre). Sert à normaliser l'URL.
 */
export function formatCompareIds(ids: number[]): string | null {
  return ids.length > 0 ? ids.join(',') : null
}

/**
 * Même sélection, dans n'importe quel ordre ? Sert à savoir si la sélection du visiteur
 * (cookie) diffère de celle d'un lien reçu, avant de lui proposer de la remplacer.
 */
export function isSameCompareSelection(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}
