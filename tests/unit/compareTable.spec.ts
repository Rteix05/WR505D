import { describe, expect, it } from 'vitest'
import {
  bestIndexes,
  buildCompareRows,
  categoryLabel,
  formatDimensions,
  shippingLabel,
  warrantyLabel,
} from '../../utils/compareTable'
import type { CompareTableProduct } from '../../types/compareTable'

// Produits 1, 2 et 3 de DummyJSON, valeurs réelles (07/10/2026).
const mascara: CompareTableProduct = {
  id: 1,
  title: 'Essence Mascara Lash Princess',
  thumbnail: 'https://cdn.dummyjson.com/1.webp',
  price: 9.99,
  discountPercentage: 10.48,
  rating: 2.56,
  availabilityStatus: 'In Stock',
  stock: 99,
  brand: 'Essence',
  category: 'beauty',
  weight: 4,
  dimensions: { width: 15.14, height: 13.08, depth: 22.99 },
  warrantyInformation: '1 week warranty',
  shippingInformation: 'Ships in 3-5 business days',
}
const palette: CompareTableProduct = {
  ...mascara,
  id: 2,
  title: 'Eyeshadow Palette with Mirror',
  price: 19.99,
  discountPercentage: 18.19,
  rating: 2.86,
  stock: 34,
  brand: 'Glamour Beauty',
  weight: 9,
  warrantyInformation: '1 year warranty',
  shippingInformation: 'Ships in 2 weeks',
}
const powder: CompareTableProduct = {
  ...mascara,
  id: 3,
  title: 'Powder Canister',
  price: 14.99,
  discountPercentage: 9.84,
  rating: 4.64,
  stock: 89,
  brand: undefined,
  weight: 8,
  warrantyInformation: '3 months warranty',
  shippingInformation: 'Ships in 1-2 business days',
}

const row = (products: CompareTableProduct[], id: string) => {
  const found = buildCompareRows(products).find((candidate) => candidate.id === id)
  if (!found) throw new Error(`ligne ${id} absente`)
  return found
}
// Intl insère des espaces insécables : on les normalise pour comparer.
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('bestIndexes', () => {
  it('plus petite ou plus grande valeur', () => {
    expect(bestIndexes([999, 1999, 1499], 'min')).toEqual([0])
    expect(bestIndexes([2.56, 2.86, 4.64], 'max')).toEqual([2])
  })

  it('égalité partielle : tous les meilleurs sont mis en évidence', () => {
    expect(bestIndexes([10, 5, 5], 'min')).toEqual([1, 2])
  })

  it('tous égaux, ou un seul produit : aucune mise en évidence', () => {
    expect(bestIndexes([5, 5, 5], 'min')).toEqual([])
    expect(bestIndexes([5], 'max')).toEqual([])
    expect(bestIndexes([], 'max')).toEqual([])
  })
})

describe('buildCompareRows', () => {
  const products = [mascara, palette, powder]

  it('toutes les lignes demandées, dans l’ordre, une cellule par produit', () => {
    const rows = buildCompareRows(products)
    expect(rows.map((candidate) => candidate.label)).toEqual([
      'Prix',
      'Remise',
      'Note',
      'Disponibilité',
      'Stock',
      'Marque',
      'Catégorie',
      'Poids',
      'Dimensions (l × h × p)',
      'Garantie',
      'Livraison',
    ])
    for (const candidate of rows) expect(candidate.cells).toHaveLength(3)
  })

  it('prix le plus bas, note la plus haute, stock le plus élevé, avec un libellé texte', () => {
    expect(row(products, 'price')).toMatchObject({ best: [0], bestLabel: 'Meilleur prix' })
    expect(row(products, 'rating')).toMatchObject({ best: [2], bestLabel: 'Meilleure note' })
    expect(row(products, 'stock')).toMatchObject({ best: [0], bestLabel: 'Stock le plus élevé' })
  })

  it('les lignes non comparables n’ont jamais de « meilleure » valeur', () => {
    for (const id of ['discount', 'availability', 'brand', 'weight', 'warranty']) {
      expect(row(products, id)).toMatchObject({ best: [], bestLabel: null })
    }
  })

  it('prix égaux : pas de « Meilleur prix »', () => {
    expect(row([mascara, { ...palette, price: 9.99 }], 'price')).toMatchObject({
      best: [],
      bestLabel: null,
    })
  })

  it('textes des cellules, en français', () => {
    expect(row(products, 'price').cells.map(plain)).toEqual(['9,99 €', '19,99 €', '14,99 €'])
    expect(row(products, 'discount').cells).toEqual(['−10 %', '−18 %', '−10 %'])
    expect(row(products, 'rating').cells).toEqual(['2,6 sur 5', '2,9 sur 5', '4,6 sur 5'])
    expect(row(products, 'availability').cells).toEqual(['En stock', 'En stock', 'En stock'])
    expect(row(products, 'stock').cells).toEqual(['99 unités', '34 unités', '89 unités'])
    expect(row(products, 'brand').cells).toEqual(['Essence', 'Glamour Beauty', 'Non renseignée'])
    expect(row(products, 'warranty').cells).toEqual(['1 semaine', '1 an', '3 mois'])
  })

  it('« same » : la ligne est identique pour tous (masquée par « uniquement les différences »)', () => {
    expect(row(products, 'availability').same).toBe(true)
    expect(row(products, 'category').same).toBe(true)
    expect(row(products, 'price').same).toBe(false)
    // Même remise affichée (−10 %) pour deux produits sur trois : pas identique pour tous.
    expect(row(products, 'discount').same).toBe(false)
  })

  it('aucun produit : lignes vides, sans erreur', () => {
    for (const candidate of buildCompareRows([])) {
      expect(candidate).toMatchObject({ cells: [], best: [], same: true })
    }
  })
})

describe('libellés', () => {
  it('catégorie : slug → nom affiché', () => {
    expect(categoryLabel('beauty')).toBe('Beauty')
    expect(categoryLabel('mens-shirts')).toBe('Mens Shirts')
  })

  it('dimensions au format français', () => {
    expect(plain(formatDimensions({ width: 15.14, height: 13.08, depth: 22.99 }))).toBe(
      '15,14 × 13,08 × 22,99',
    )
  })

  it.each([
    ['1 week warranty', '1 semaine'],
    ['3 months warranty', '3 mois'],
    ['1 year warranty', '1 an'],
    ['5 year warranty', '5 ans'],
    ['Lifetime warranty', 'À vie'],
    ['No warranty', 'Aucune'],
    ['Garantie inconnue', 'Garantie inconnue'],
  ])('garantie %j → %j', (input, expected) => {
    expect(warrantyLabel(input)).toBe(expected)
  })

  it.each([
    ['Ships overnight', 'Expédié en 24 h'],
    ['Ships in 1-2 business days', 'Expédié sous 1 à 2 jours ouvrés'],
    ['Ships in 1 business day', 'Expédié sous 1 jour ouvré'],
    ['Ships in 1 week', 'Expédié sous 1 semaine'],
    ['Ships in 2 weeks', 'Expédié sous 2 semaines'],
    ['Ships in 1 month', 'Expédié sous 1 mois'],
    ['Ships by boat', 'Ships by boat'],
  ])('livraison %j → %j', (input, expected) => {
    expect(shippingLabel(input)).toBe(expected)
  })
})
