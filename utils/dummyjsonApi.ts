import type { SortField, SortOrder } from '../types/catalog'
import type { Category, Product, ProductsResponse } from '../types/dummyjson'

export interface ApiRequestOptions {
  query?: Record<string, string | number>
  /** Permet d'annuler une requête devenue inutile (ex. recherche remplacée par une plus récente). */
  signal?: AbortSignal
}

export type ApiRequest = <T>(url: string, options?: ApiRequestOptions) => Promise<T>

/** Pagination et tri acceptés par toutes les routes de liste de produits. */
export interface ProductListParams {
  limit?: number
  skip?: number
  /** Seuls champs triables proposés à l'utilisateur (`keyof Product` acceptait `reviews`, `images`…). */
  sortBy?: SortField
  order?: SortOrder
  signal?: AbortSignal
}

export interface DummyJsonApi {
  getProducts: (params?: ProductListParams) => Promise<ProductsResponse>
  searchProducts: (q: string, params?: ProductListParams) => Promise<ProductsResponse>
  getProductsByCategory: (slug: string, params?: ProductListParams) => Promise<ProductsResponse>
  getProduct: (id: number, options?: { signal?: AbortSignal }) => Promise<Product>
  getCategories: () => Promise<Category[]>
}

/** Paramètres de liste → query DummyJSON, sans les clés non renseignées. */
export function listQuery(params: ProductListParams = {}): Record<string, string | number> {
  const query: Record<string, string | number> = {}
  if (params.limit !== undefined) query.limit = params.limit
  if (params.skip !== undefined) query.skip = params.skip
  // `order` seul n'a aucun effet côté API : on ne l'envoie qu'avec `sortBy`.
  if (params.sortBy !== undefined) {
    query.sortBy = params.sortBy
    query.order = params.order ?? 'asc'
  }
  return query
}

/**
 * Point d'entrée unique vers les routes publiques de DummyJSON. Le transport est injecté :
 * `useApi()` branche $fetch et `runtimeConfig.public.apiBase`, les tests branchent un faux.
 * Les routes authentifiées (/auth/me, paniers) passent par `$authFetch`, qui exige un jeton.
 */
export function createDummyJsonApi(request: ApiRequest): DummyJsonApi {
  return {
    getProducts: (params = {}) =>
      request<ProductsResponse>('/products', { query: listQuery(params), signal: params.signal }),

    searchProducts: (q, params = {}) =>
      request<ProductsResponse>('/products/search', {
        query: { q, ...listQuery(params) },
        signal: params.signal,
      }),

    // Le slug vient de l'URL de la page : encodé pour ne jamais sortir du chemin prévu.
    getProductsByCategory: (slug, params = {}) =>
      request<ProductsResponse>(`/products/category/${encodeURIComponent(slug)}`, {
        query: listQuery(params),
        signal: params.signal,
      }),

    getProduct: (id, options = {}) =>
      request<Product>(`/products/${id}`, { signal: options.signal }),

    getCategories: () => request<Category[]>('/products/categories'),
  }
}
