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

  describe('getProductsByIds', () => {
    /** Faux transport par identifiant : produit trouvé, 404, ou erreur réseau (sans code HTTP). */
    function fakeCatalogue(delays: Record<number, number> = {}) {
      const request = vi.fn(async (url: string, _options?: unknown) => {
        const id = Number(url.split('/').pop())
        await new Promise((resolve) => setTimeout(resolve, delays[id] ?? 0))
        if (id === 404) throw Object.assign(new Error('Not Found'), { statusCode: 404 })
        if (id === 500) throw new TypeError('fetch failed')
        return { id, title: `Produit ${id}` }
      })
      return { request, api: createDummyJsonApi(request as ApiRequest) }
    }

    it('un appel par identifiant, tous lancés en même temps', async () => {
      const { request, api } = fakeCatalogue({ 1: 30, 2: 30, 3: 30 })
      const pending = api.getProductsByIds([1, 2, 3])
      // Les 3 requêtes sont parties avant que la première ne réponde : pas d'appels en série.
      expect(request).toHaveBeenCalledTimes(3)
      await pending
      expect(request.mock.calls.map(([url]) => url)).toEqual([
        '/products/1',
        '/products/2',
        '/products/3',
      ])
    })

    it('garde l’ordre des identifiants, même si les réponses arrivent dans le désordre', async () => {
      const { api } = fakeCatalogue({ 7: 40, 3: 0, 42: 20 })
      const result = await api.getProductsByIds([7, 3, 42])
      expect(result.products.map((product) => product.id)).toEqual([7, 3, 42])
    })

    it('succès partiel : un 404 et une erreur réseau n’empêchent pas les autres', async () => {
      const { api } = fakeCatalogue()
      const result = await api.getProductsByIds([1, 404, 2, 500, 3])
      expect(result).toEqual({
        products: [
          { id: 1, title: 'Produit 1' },
          { id: 2, title: 'Produit 2' },
          { id: 3, title: 'Produit 3' },
        ],
        // 404 : le produit n'existe pas, on peut le retirer (URL, cookie).
        missingIds: [404],
        // Autre échec : il existe peut-être, on le garde et on propose de réessayer.
        failedIds: [500],
      })
    })

    it('tout en échec, ou aucun identifiant : jamais d’exception', async () => {
      const { request, api } = fakeCatalogue()
      await expect(api.getProductsByIds([404, 500])).resolves.toEqual({
        products: [],
        missingIds: [404],
        failedIds: [500],
      })
      await expect(api.getProductsByIds([])).resolves.toEqual({
        products: [],
        missingIds: [],
        failedIds: [],
      })
      expect(request).toHaveBeenCalledTimes(2)
    })

    it('un identifiant en double ne coûte qu’un appel', async () => {
      const { request, api } = fakeCatalogue()
      const result = await api.getProductsByIds([5, 5, 6])
      expect(request).toHaveBeenCalledTimes(2)
      expect(result.products.map((product) => product.id)).toEqual([5, 6])
    })

    it('`select` et `signal` sont transmis à chaque appel', async () => {
      const { request, api } = fakeCatalogue()
      const controller = new AbortController()
      await api.getProductsByIds([1, 2], {
        select: ['title', 'price', 'thumbnail'],
        signal: controller.signal,
      })
      for (const [, options] of request.mock.calls) {
        expect(options).toEqual({
          query: { select: 'title,price,thumbnail' },
          signal: controller.signal,
        })
      }
    })

    it('sans `select` : produits complets, pas de paramètre `select` envoyé', async () => {
      const { request, api } = fakeCatalogue()
      await api.getProductsByIds([1])
      expect(request).toHaveBeenCalledWith('/products/1', { query: undefined, signal: undefined })
    })
  })
})
