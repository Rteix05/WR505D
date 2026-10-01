import { describe, expect, it } from 'vitest'
import {
  hasPriceFilter,
  inPriceRange,
  parsePriceInput,
  priceInputText,
  priceRangeLabel,
} from '../../utils/priceFilter'

const range = (minPrice: number | null, maxPrice: number | null) => ({ minPrice, maxPrice })

describe('parsePriceInput', () => {
  it('vide = pas de borne', () => {
    expect(parsePriceInput('')).toEqual({ valid: true, value: null })
    expect(parsePriceInput('   ')).toEqual({ valid: true, value: null })
  })

  it('accepte entier, point, virgule et espaces autour', () => {
    expect(parsePriceInput('10')).toEqual({ valid: true, value: 10 })
    expect(parsePriceInput('19.99')).toEqual({ valid: true, value: 19.99 })
    expect(parsePriceInput(' 19,9 ')).toEqual({ valid: true, value: 19.9 })
    expect(parsePriceInput('0')).toEqual({ valid: true, value: 0 })
  })

  it.each(['abc', '-5', '10,999', '1e3', '10 €', '1.2.3'])('refuse %j', (text) => {
    expect(parsePriceInput(text)).toEqual({ valid: false })
  })
})

describe('priceInputText', () => {
  it('affiche la virgule française, vide sans borne', () => {
    expect(priceInputText(10.5)).toBe('10,5')
    expect(priceInputText(10)).toBe('10')
    expect(priceInputText(null)).toBe('')
  })
})

describe('inPriceRange', () => {
  it('bornes incluses', () => {
    expect(inPriceRange(10, range(10, 50))).toBe(true)
    expect(inPriceRange(50, range(10, 50))).toBe(true)
    expect(inPriceRange(9.99, range(10, 50))).toBe(false)
    expect(inPriceRange(50.01, range(10, 50))).toBe(false)
  })

  it('une seule borne, ou aucune', () => {
    expect(inPriceRange(1000, range(10, null))).toBe(true)
    expect(inPriceRange(5, range(10, null))).toBe(false)
    expect(inPriceRange(0.79, range(null, 1))).toBe(true)
    expect(inPriceRange(36999.99, range(null, null))).toBe(true)
  })

  it('compare en centimes : pas d’erreur de virgule flottante à la borne', () => {
    // 0.1 + 0.2 = 0.30000000000000004 en JavaScript.
    expect(inPriceRange(0.1 + 0.2, range(null, 0.3))).toBe(true)
  })
})

describe('hasPriceFilter', () => {
  it('0 est une vraie borne', () => {
    expect(hasPriceFilter(range(null, null))).toBe(false)
    expect(hasPriceFilter(range(0, null))).toBe(true)
    expect(hasPriceFilter(range(null, 20))).toBe(true)
  })
})

describe('priceRangeLabel', () => {
  // Intl insère des espaces insécables : on les normalise pour comparer.
  const label = (minPrice: number | null, maxPrice: number | null) =>
    priceRangeLabel(range(minPrice, maxPrice)).replace(/\s/g, ' ')

  it('les trois formes, et vide sans filtre', () => {
    expect(label(10, 50)).toBe('entre 10,00 € et 50,00 €')
    expect(label(10, null)).toBe('à partir de 10,00 €')
    expect(label(null, 49.9)).toBe("jusqu'à 49,90 €")
    expect(label(null, null)).toBe('')
  })
})
