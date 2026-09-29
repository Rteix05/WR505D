import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  clampPage,
  DEFAULT_FILTERS,
  pageCount,
  paginationParams,
  parseCatalogQuery,
  SEARCH_MAX_LENGTH,
  SORT_OPTIONS,
  sortFromOption,
  sortOptionFor,
  sortParams,
  toCatalogQuery,
  updateFilters,
} from '../../utils/catalogQuery'
import type { CatalogFilters } from '../../types/catalog'

const filters = (changes: Partial<CatalogFilters> = {}): CatalogFilters => ({
  ...DEFAULT_FILTERS,
  ...changes,
})

describe('parseCatalogQuery', () => {
  it('URL vide : filtres par défaut', () => {
    expect(parseCatalogQuery({})).toEqual(DEFAULT_FILTERS)
  })

  it('lit une URL complète', () => {
    expect(
      parseCatalogQuery({
        page: '3',
        q: 'mascara',
        category: 'beauty',
        sortBy: 'price',
        order: 'desc',
        minPrice: '5',
        maxPrice: '20.5',
      }),
    ).toEqual({
      page: 3,
      q: 'mascara',
      category: 'beauty',
      sortBy: 'price',
      order: 'desc',
      minPrice: 5,
      maxPrice: 20.5,
    })
  })

  it('paramètre répété : garde la première valeur', () => {
    expect(parseCatalogQuery({ page: ['2', '5'], q: ['rouge', 'bleu'] })).toMatchObject({
      page: 2,
      q: 'rouge',
    })
  })

  it.each([
    ['0', 1],
    ['-2', 1],
    ['2.5', 1],
    ['1e3', 1],
    ['abc', 1],
    ['', 1],
    ['99999999999999999999', 1],
    ['7', 7],
  ])('page « %s » → %i', (page, expected) => {
    expect(parseCatalogQuery({ page }).page).toBe(expected)
  })

  it('recherche : espaces retirés, longueur limitée', () => {
    expect(parseCatalogQuery({ q: '  rouge à lèvres  ' }).q).toBe('rouge à lèvres')
    expect(parseCatalogQuery({ q: 'a'.repeat(300) }).q).toHaveLength(SEARCH_MAX_LENGTH)
  })

  it.each([
    ['mens-shirts', 'mens-shirts'],
    ['beauty', 'beauty'],
    ['Beauty', null],
    ['../admin', null],
    ['beauty--x', null],
    ['-beauty', null],
    ['', null],
  ])('catégorie « %s » → %s', (category, expected) => {
    expect(parseCatalogQuery({ category }).category).toBe(expected)
  })

  it('tri inconnu ignoré, ordre inconnu remplacé par asc', () => {
    expect(parseCatalogQuery({ sortBy: 'stock', order: 'random' })).toMatchObject({
      sortBy: null,
      order: 'asc',
    })
  })

  it.each([
    ['10', 10],
    ['10.5', 10.5],
    ['10,50', 10.5],
    [' 12 ', 12],
    ['0', 0],
    ['-5', null],
    ['10.555', null],
    ['abc', null],
    ['', null],
    ['Infinity', null],
  ])('prix « %s » → %s', (minPrice, expected) => {
    expect(parseCatalogQuery({ minPrice }).minPrice).toBe(expected)
  })

  it('bornes de prix inversées : remises dans l’ordre', () => {
    expect(parseCatalogQuery({ minPrice: '50', maxPrice: '10' })).toMatchObject({
      minPrice: 10,
      maxPrice: 50,
    })
  })

  it('valeurs non textuelles ignorées (null, nombre, objet)', () => {
    expect(parseCatalogQuery({ page: null, q: 42, category: { a: 1 }, minPrice: [] })).toEqual(
      DEFAULT_FILTERS,
    )
  })
})

describe('toCatalogQuery', () => {
  it('filtres par défaut : URL vide', () => {
    expect(toCatalogQuery(DEFAULT_FILTERS)).toEqual({})
  })

  it('n’écrit que ce qui diffère des valeurs par défaut', () => {
    expect(toCatalogQuery(filters({ q: 'rouge', page: 2 }))).toEqual({ q: 'rouge', page: '2' })
  })

  it('l’ordre n’est écrit qu’avec un tri', () => {
    expect(toCatalogQuery(filters({ order: 'desc' }))).toEqual({})
    expect(toCatalogQuery(filters({ sortBy: 'rating', order: 'desc' }))).toEqual({
      sortBy: 'rating',
      order: 'desc',
    })
  })

  it('prix à 0 conservé (ce n’est pas une absence de filtre)', () => {
    expect(toCatalogQuery(filters({ minPrice: 0 }))).toEqual({ minPrice: '0' })
  })

  it('clés toujours dans le même ordre : une vue = une URL', () => {
    const query = toCatalogQuery({
      page: 2,
      q: 'x',
      category: 'beauty',
      sortBy: 'price',
      order: 'asc',
      minPrice: 1,
      maxPrice: 2,
    })
    expect(Object.keys(query)).toEqual([
      'q',
      'category',
      'sortBy',
      'order',
      'minPrice',
      'maxPrice',
      'page',
    ])
  })

  it('aller-retour : relire l’URL écrite redonne les mêmes filtres', () => {
    const original = filters({
      page: 4,
      q: 'crème',
      category: 'skin-care',
      sortBy: 'title',
      order: 'desc',
      minPrice: 9.99,
      maxPrice: 100,
    })
    expect(parseCatalogQuery(toCatalogQuery(original))).toEqual(original)
  })
})

describe('updateFilters', () => {
  it('changer de page garde les autres filtres', () => {
    expect(updateFilters(filters({ q: 'rouge', page: 2 }), { page: 3 })).toEqual(
      filters({ q: 'rouge', page: 3 }),
    )
  })

  it('changer un filtre revient à la page 1', () => {
    expect(updateFilters(filters({ q: 'rouge', page: 5 }), { category: 'beauty' })).toEqual(
      filters({ q: 'rouge', category: 'beauty', page: 1 }),
    )
  })

  it('page explicite avec un filtre : la page demandée est gardée', () => {
    expect(updateFilters(filters({ page: 5 }), { q: 'x', page: 2 }).page).toBe(2)
  })

  it('ne modifie pas l’objet reçu', () => {
    const current = filters({ page: 5 })
    updateFilters(current, { q: 'x' })
    expect(current.page).toBe(5)
  })
})

describe('activeFilterCount', () => {
  it('compte recherche, catégorie et bornes de prix, pas la page ni le tri', () => {
    expect(activeFilterCount(filters({ page: 3, sortBy: 'price' }))).toBe(0)
    expect(
      activeFilterCount(filters({ q: 'x', category: 'beauty', minPrice: 0, maxPrice: 10 })),
    ).toBe(4)
  })
})

describe('tri', () => {
  it('chaque option du menu fait l’aller-retour', () => {
    for (const option of SORT_OPTIONS) {
      expect(sortOptionFor(filters(sortFromOption(option.value)))).toBe(option)
    }
  })

  it('pas de tri : Pertinence, quel que soit l’ordre', () => {
    expect(sortOptionFor(filters({ order: 'desc' })).value).toBe('relevance')
  })

  it('valeur inconnue : Pertinence', () => {
    expect(sortFromOption('hack')).toEqual({ sortBy: null, order: 'asc' })
  })

  it('paramètres API : vides sans tri', () => {
    expect(sortParams(DEFAULT_FILTERS)).toEqual({})
    expect(sortParams(filters({ sortBy: 'rating', order: 'desc' }))).toEqual({
      sortBy: 'rating',
      order: 'desc',
    })
  })
})

describe('pagination', () => {
  it('nombre de pages : 12 produits par page, au moins 1', () => {
    expect(pageCount(194)).toBe(17)
    expect(pageCount(12)).toBe(1)
    expect(pageCount(13)).toBe(2)
    expect(pageCount(0)).toBe(1)
  })

  it('page ramenée dans les bornes', () => {
    expect(clampPage(99, 194)).toBe(17)
    expect(clampPage(0, 194)).toBe(1)
    expect(clampPage(5, 194)).toBe(5)
    expect(clampPage(3, 0)).toBe(1)
  })

  it('limit / skip DummyJSON', () => {
    expect(paginationParams(1)).toEqual({ limit: 12, skip: 0 })
    expect(paginationParams(3)).toEqual({ limit: 12, skip: 24 })
    expect(paginationParams(2, 30)).toEqual({ limit: 30, skip: 30 })
  })
})
