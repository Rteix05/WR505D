import type { CatalogFilters } from '../types/catalog'
import { parsePrice } from './catalogQuery'
import { formatCents, toCents } from './price'

/** Résultat de la lecture d'un champ de prix du formulaire. */
export type PriceInput = { valid: true; value: number | null } | { valid: false }

/**
 * Champ de prix → euros. Vide = pas de borne. Mêmes règles que l'URL (`parsePrice`) :
 * positif, 2 décimales au plus, virgule acceptée. Contrairement à l'URL, une saisie
 * invalide n'est pas ignorée en silence : l'utilisateur doit savoir pourquoi rien ne change.
 */
export function parsePriceInput(text: string): PriceInput {
  if (text.trim() === '') return { valid: true, value: null }
  const value = parsePrice(text)
  return value === null ? { valid: false } : { valid: true, value }
}

/** Prix → texte du champ, au format français : 10.5 → « 10,5 ». */
export function priceInputText(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',')
}

/**
 * Le prix est-il dans la fourchette (bornes incluses) ? Comparaison en centimes entiers :
 * en euros, 0.1 + 0.2 > 0.3 en JavaScript, un produit à la borne pourrait être exclu.
 */
export function inPriceRange(
  price: number,
  range: Pick<CatalogFilters, 'minPrice' | 'maxPrice'>,
): boolean {
  const cents = toCents(price)
  if (range.minPrice !== null && cents < toCents(range.minPrice)) return false
  if (range.maxPrice !== null && cents > toCents(range.maxPrice)) return false
  return true
}

export function hasPriceFilter(filters: Pick<CatalogFilters, 'minPrice' | 'maxPrice'>): boolean {
  return filters.minPrice !== null || filters.maxPrice !== null
}

/** Fourchette lisible : « entre 10,00 € et 50,00 € », « à partir de 10,00 € », « jusqu'à 50,00 € ». */
export function priceRangeLabel(range: Pick<CatalogFilters, 'minPrice' | 'maxPrice'>): string {
  const format = (euros: number): string => formatCents(toCents(euros))
  if (range.minPrice !== null && range.maxPrice !== null) {
    return `entre ${format(range.minPrice)} et ${format(range.maxPrice)}`
  }
  if (range.minPrice !== null) return `à partir de ${format(range.minPrice)}`
  if (range.maxPrice !== null) return `jusqu'à ${format(range.maxPrice)}`
  return ''
}
