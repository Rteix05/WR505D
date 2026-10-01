import { describe, expect, it } from 'vitest'
import { filterLocally, localPage, needsLocalFiltering } from '../../utils/catalogSearch'
import { DEFAULT_FILTERS } from '../../utils/catalogQuery'
import type { Product } from '../../types/dummyjson'

const product = (id: number, category: string, price = 10) => ({ id, category, price }) as Product

describe('needsLocalFiltering', () => {
  it('dès qu’une borne de prix est posée (#5), même 0', () => {
    expect(needsLocalFiltering({ ...DEFAULT_FILTERS, minPrice: 0 })).toBe(true)
    expect(needsLocalFiltering({ ...DEFAULT_FILTERS, maxPrice: 20 })).toBe(true)
  })

  it('sinon, seulement quand une recherche et une catégorie sont combinées', () => {
    expect(needsLocalFiltering(DEFAULT_FILTERS)).toBe(false)
    expect(needsLocalFiltering({ ...DEFAULT_FILTERS, q: 'phone' })).toBe(false)
    expect(needsLocalFiltering({ ...DEFAULT_FILTERS, category: 'smartphones' })).toBe(false)
    expect(needsLocalFiltering({ ...DEFAULT_FILTERS, q: 'phone', category: 'smartphones' })).toBe(
      true,
    )
  })
})

describe('filterLocally', () => {
  const noPrice = { minPrice: null, maxPrice: null }
  const results = [
    product(101, 'mobile-accessories', 19.99),
    product(121, 'smartphones', 299.99),
    product(123, 'smartphones', 1099.99),
  ]

  it('garde la catégorie demandée, dans l’ordre reçu', () => {
    expect(filterLocally(results, { category: 'smartphones', ...noPrice })).toEqual([
      results[1],
      results[2],
    ])
  })

  it('sans filtre, garde tout', () => {
    expect(filterLocally(results, { category: null, ...noPrice })).toEqual(results)
  })

  it('prix seul, puis prix + catégorie', () => {
    expect(filterLocally(results, { category: null, minPrice: 0, maxPrice: 300 })).toEqual([
      results[0],
      results[1],
    ])
    expect(filterLocally(results, { category: 'smartphones', minPrice: 0, maxPrice: 300 })).toEqual(
      [results[1]],
    )
  })
})

describe('localPage', () => {
  // 17 résultats : page 1 = 12, page 2 = 5 (même découpage que l'API).
  const all = Array.from({ length: 17 }, (_, i) => product(i + 1, 'smartphones'))

  it('découpe en pages de 12 au format ProductsResponse', () => {
    const page2 = localPage(all, 2)
    expect(page2.products.map((p) => p.id)).toEqual([13, 14, 15, 16, 17])
    expect(page2).toMatchObject({ total: 17, skip: 12, limit: 12 })
  })

  it('page hors bornes : aucun produit mais le total reste connu', () => {
    expect(localPage(all, 5)).toMatchObject({ products: [], total: 17 })
  })

  it('aucun résultat', () => {
    expect(localPage([], 1)).toEqual({ products: [], total: 0, skip: 0, limit: 12 })
  })
})
