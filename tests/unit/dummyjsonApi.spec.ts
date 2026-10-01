import { describe, expect, it, vi } from 'vitest'
import { createDummyJsonApi, listQuery } from '../../utils/dummyjsonApi'
import type { ApiRequest } from '../../utils/dummyjsonApi'

/** Faux transport : enregistre chaque appel et renvoie `response`. */
function fakeRequest(response: unknown = {}) {
  const request = vi.fn((_url: string, _options?: unknown) => Promise.resolve(response))
  return { request, api: createDummyJsonApi(request as ApiRequest) }
}

describe('listQuery', () => {
  it('omet les paramètres non renseignés', () => {
    expect(listQuery()).toEqual({})
    expect(listQuery({ limit: 12, skip: 24 })).toEqual({ limit: 12, skip: 24 })
  })

  it("n'envoie `order` qu'avec `sortBy`, et asc par défaut", () => {
    expect(listQuery({ order: 'desc' })).toEqual({})
    expect(listQuery({ sortBy: 'price' })).toEqual({ sortBy: 'price', order: 'asc' })
    expect(listQuery({ sortBy: 'rating', order: 'desc' })).toEqual({
      sortBy: 'rating',
      order: 'desc',
    })
  })
})

describe('createDummyJsonApi', () => {
  it('getProducts : GET /products avec pagination et tri', async () => {
    const page = { products: [], total: 194, skip: 12, limit: 12 }
    const { request, api } = fakeRequest(page)

    await expect(api.getProducts({ limit: 12, skip: 12, sortBy: 'price' })).resolves.toBe(page)
    expect(request).toHaveBeenCalledWith('/products', {
      query: { limit: 12, skip: 12, sortBy: 'price', order: 'asc' },
      signal: undefined,
    })
  })

  it('searchProducts : GET /products/search avec q et le signal d’annulation', async () => {
    const { request, api } = fakeRequest()
    const controller = new AbortController()

    await api.searchProducts('phone', { limit: 12, signal: controller.signal })
    expect(request).toHaveBeenCalledWith('/products/search', {
      query: { q: 'phone', limit: 12 },
      signal: controller.signal,
    })
  })

  it('getProductsByCategory : encode le slug dans le chemin', async () => {
    const { request, api } = fakeRequest()

    await api.getProductsByCategory('mens-shirts')
    await api.getProductsByCategory('../auth/me')
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      '/products/category/mens-shirts',
      '/products/category/..%2Fauth%2Fme',
    ])
  })

  it('getProduct et getCategories', async () => {
    const { request, api } = fakeRequest()

    await api.getProduct(42)
    await api.getCategories()
    expect(request).toHaveBeenNthCalledWith(1, '/products/42', { signal: undefined })
    expect(request).toHaveBeenNthCalledWith(2, '/products/categories')
  })

  it('laisse remonter les erreurs HTTP à l’appelant (ex. produit introuvable)', async () => {
    const notFound = Object.assign(new Error('Not Found'), { statusCode: 404 })
    const api = createDummyJsonApi((() => Promise.reject(notFound)) as ApiRequest)

    await expect(api.getProduct(99999)).rejects.toBe(notFound)
  })

  describe('getAllProductSummaries', () => {
    const select = 'id,title,price,rating,discountPercentage,thumbnail,category'

    it('sans recherche ni catégorie : tout le catalogue, champs réduits, tri transmis', async () => {
      const { request, api } = fakeRequest()
      await api.getAllProductSummaries({ q: '', category: null }, { sortBy: 'price' })
      expect(request).toHaveBeenCalledWith('/products', {
        query: { limit: 0, select, sortBy: 'price', order: 'asc' },
        signal: undefined,
      })
    })

    it('catégorie seule : route de la catégorie, slug encodé', async () => {
      const { request, api } = fakeRequest()
      await api.getAllProductSummaries({ q: '', category: 'mens-shirts' })
      expect(request).toHaveBeenCalledWith('/products/category/mens-shirts', {
        query: { limit: 0, select },
        signal: undefined,
      })
    })

    it('recherche (avec ou sans catégorie) : route de recherche, catégorie filtrée ensuite', async () => {
      const { request, api } = fakeRequest()
      const controller = new AbortController()
      await api.getAllProductSummaries(
        { q: 'phone', category: 'smartphones' },
        { signal: controller.signal },
      )
      expect(request).toHaveBeenCalledWith('/products/search', {
        query: { q: 'phone', limit: 0, select },
        signal: controller.signal,
      })
    })
  })
})
