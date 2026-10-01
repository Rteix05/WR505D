import type { ProductStock } from '../types/productDetails'

/** Seuil du sujet : « Plus que X en stock » en dessous de 5. */
export const LOW_STOCK_THRESHOLD = 5

/** Longueur conseillée d'une meta description (au-delà, Google la coupe). */
export const SEO_DESCRIPTION_MAX_LENGTH = 160

/**
 * Identifiant de l'URL `/produits/[id]` → entier strictement positif, ou `null`.
 * Validé avant tout appel : `/produits/abc` ou `/produits/1.5` donnent une 404 sans
 * interroger l'API. `unknown` car vue-router peut donner une chaîne ou un tableau.
 */
export function parseProductId(param: unknown): number | null {
  const value = Array.isArray(param) ? param[0] : param
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id >= 1 ? id : null
}

/**
 * État du stock affiché sur la fiche. On se base sur `stock` et pas sur
 * `availabilityStatus` : l'API renvoie parfois « Low Stock » avec 5 exemplaires ou plus.
 */
export function productStock(stock: number): ProductStock {
  if (stock <= 0) return { level: 'out', label: 'Rupture de stock' }
  if (stock < LOW_STOCK_THRESHOLD) return { level: 'low', label: `Plus que ${stock} en stock` }
  return { level: 'in', label: 'En stock' }
}

/**
 * Description courte pour les moteurs de recherche et les aperçus de partage :
 * coupée sur un espace (jamais au milieu d'un mot), avec « … » si elle a été raccourcie.
 */
export function seoDescription(text: string, maxLength = SEO_DESCRIPTION_MAX_LENGTH): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean
  const cut = clean.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?]+$/, '')}…`
}
