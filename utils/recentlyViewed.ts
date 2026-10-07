/** Nombre de produits gardés dans l'historique (imposé par le sujet). */
export const RECENTLY_VIEWED_MAX = 10

/**
 * Ajoute le produit visité en tête de l'historique. `ids` doit venir de
 * `parseRecentlyViewedCookie` (déjà validé, sans doublon) : un tableau quelconque n'est pas revérifié. S'il y est déjà, il remonte en tête
 * (pas de doublon) ; au-delà de `max`, le plus ancien sort. Ne modifie pas `ids`.
 * Un identifiant invalide (0, négatif, décimal) est ignoré : l'historique reste tel quel.
 */
export function pushRecentlyViewed(ids: number[], id: number, max = RECENTLY_VIEWED_MAX): number[] {
  if (!isProductId(id)) return ids.slice(0, Math.max(0, max))
  return [id, ...ids.filter((existing) => existing !== id)].slice(0, Math.max(0, max))
}

/**
 * Lit le cookie `recently_viewed`. Il vient du navigateur : il peut être absent, ancien
 * ou modifié à la main. Ne lève jamais d'erreur : toute valeur invalide est ignorée.
 *
 * Formes acceptées, car `useCookie` décode lui-même la valeur quand il peut :
 * - texte `"12,5,3"` (format écrit par `serializeRecentlyViewed`) ;
 * - tableau `[12, 5, 3]` ou `["12", "5"]` (JSON valide) ;
 * - nombre seul `12` (un seul produit : `useCookie` a lu `"12"` comme un nombre).
 *
 * Résultat : identifiants valides, sans doublon (la première occurrence, la plus récente,
 * est gardée), au plus `RECENTLY_VIEWED_MAX`.
 */
export function parseRecentlyViewedCookie(raw: unknown): number[] {
  const ids: number[] = []
  for (const value of rawValues(raw)) {
    const id = toProductId(value)
    if (id !== null && !ids.includes(id)) ids.push(id)
    if (ids.length === RECENTLY_VIEWED_MAX) break
  }
  return ids
}

/**
 * Historique → valeur du cookie : `"12,5,3"`. Pour 10 produits à 3 chiffres : 39 caractères,
 * 57 octets une fois écrite par `useCookie` (qui encode les virgules en `%2C`).
 */
export function serializeRecentlyViewed(ids: number[]): string {
  return ids.join(',')
}

/** Valeurs brutes à valider une par une, quelle que soit la forme du cookie. */
function rawValues(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'number') return [raw]
  if (typeof raw !== 'string') return []
  const text = raw.trim()
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return [] // JSON invalide (`"[1,"`) : historique vide plutôt qu'une erreur
    }
  }
  return text.split(',')
}

/** Nombre entier ≥ 1, ou texte écrit uniquement en chiffres (refuse `"1.5"`, `"1e3"`, `" "`). */
function toProductId(value: unknown): number | null {
  if (typeof value === 'number') return isProductId(value) ? value : null
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!/^\d+$/.test(text)) return null
  const id = Number(text)
  return isProductId(id) ? id : null
}

function isProductId(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1
}
