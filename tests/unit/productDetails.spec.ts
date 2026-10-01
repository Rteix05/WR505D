import { describe, expect, it } from 'vitest'
import {
  LOW_STOCK_THRESHOLD,
  parseProductId,
  productStock,
  seoDescription,
} from '../../utils/productDetails'

describe('parseProductId', () => {
  it.each([
    ['1', 1],
    ['194', 194],
    [['12', '13'], 12],
  ])('accepte %j', (param, expected) => {
    expect(parseProductId(param)).toBe(expected)
  })

  // Toutes ces URL donnent une 404 sans appeler l'API.
  it.each([
    ['texte', 'abc'],
    ['zéro', '0'],
    ['négatif', '-1'],
    ['décimal', '1.5'],
    ['notation scientifique', '1e3'],
    ['espaces', ' 12 '],
    ['vide', ''],
    ['trop grand', '99999999999999999999'],
    ['absent', undefined],
    ['tableau vide', []],
  ])('refuse %s', (_label, param) => {
    expect(parseProductId(param)).toBeNull()
  })
})

describe('productStock', () => {
  it('rupture à 0 (et stock négatif par sécurité)', () => {
    expect(productStock(0)).toEqual({ level: 'out', label: 'Rupture de stock' })
    expect(productStock(-2)).toEqual({ level: 'out', label: 'Rupture de stock' })
  })

  it('« Plus que X en stock » de 1 à 4', () => {
    expect(productStock(1)).toEqual({ level: 'low', label: 'Plus que 1 en stock' })
    expect(productStock(LOW_STOCK_THRESHOLD - 1)).toEqual({
      level: 'low',
      label: 'Plus que 4 en stock',
    })
  })

  it('en stock à partir du seuil (5, limite exclue du stock faible)', () => {
    expect(productStock(LOW_STOCK_THRESHOLD)).toEqual({ level: 'in', label: 'En stock' })
    expect(productStock(99)).toEqual({ level: 'in', label: 'En stock' })
  })
})

describe('seoDescription', () => {
  it('texte court : gardé tel quel, espaces nettoyés', () => {
    expect(seoDescription('  Un   mascara\nvolumisant. ')).toBe('Un mascara volumisant.')
  })

  it('texte long : coupé sur un espace, jamais au milieu d’un mot, avec « … »', () => {
    const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    const result = seoDescription(text, 30)
    expect(result).toBe('Lorem ipsum dolor sit amet…')
    expect(result.length).toBeLessThanOrEqual(30)
  })

  it('ne garde pas de ponctuation avant « … »', () => {
    expect(seoDescription('Un produit, très pratique, vraiment.', 20)).toBe('Un produit, très…')
  })

  it('un seul mot trop long : coupé quand même, sans dépasser', () => {
    const result = seoDescription('a'.repeat(50), 20)
    expect(result).toHaveLength(20)
    expect(result.endsWith('…')).toBe(true)
  })

  it('description vide : chaîne vide', () => {
    expect(seoDescription('')).toBe('')
  })
})
