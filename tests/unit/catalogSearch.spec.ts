import { describe, expect, it } from 'vitest'
import { filterLocally, localPage, needsLocalFiltering } from '../../utils/catalogSearch'
import { DEFAULT_FILTERS } from '../../utils/catalogQuery'
import type { Product } from '../../types/dummyjson'

const product = (id: number, category: string) => ({ id, category }) as Product

describe('needsLocalFiltering', () => {
  it('seulement quand une recherche et une catégorie sont combinées', () => {
    expect(needsLocalFiltering(DEFAULT_FILTERS)).toBe(false)
    expect(needsLocalFiltering({ ...DEFAULT_FILTERS, q: 'phone' })).toBe(false)
    expect(needsLocalFiltering({ ...DEFAULT_FILTERS, category: 'smartphones' })).toBe(false)
    expect(needsLocalFiltering({ ...DEFAULT_FILTERS, q: 'phone', category: 'smartphones' })).toBe(
      true,
    )
  })
})

describe('filterLocally', () => {
  const results = [product(101, 'mobile-accessories'), product(121, 'smartphones')]

  it('garde la catégorie demandée, dans l’ordre reçu', () => {
    expect(filterLocally(results, { category: 'smartphones' })).toEqual([results[1]])
  })

  it('sans catégorie, garde tout', () => {
    expect(filterLocally(results, { category: null })).toEqual(results)
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
