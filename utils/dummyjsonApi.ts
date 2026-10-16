import type { SortField, SortOrder } from '../types/catalog'
import type { Category, Product, ProductSummary, ProductsResponse } from '../types/dummyjson'
import { httpStatusOf } from './auth'
import { sortCompareResults, type CompareLoadResult } from './compare'

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

/** Recherche et catégorie dont on veut tous les produits (filtrage local, #3 et #5). */
export interface ProductScope {
  q: string
  category: string | null
}

/** Champs demandés avec `select` : ceux de `ProductSummary`, et rien d'autre. */
export const PRODUCT_SUMMARY_FIELDS = [
  'id',
  'title',
  'price',
  'rating',
  'discountPercentage',
  'thumbnail',
  'category',
] as const satisfies readonly (keyof ProductSummary)[]

/**
 * `getProductsByIds` : produits complets sans `select`, réduits aux champs demandés avec.
 * DummyJSON renvoie toujours `id`, même s'il n'est pas dans `select`.
 */
export interface GetProductsByIds {
  (ids: readonly number[], options?: { signal?: AbortSignal }): Promise<CompareLoadResult<Product>>
  <K extends keyof Product>(
    ids: readonly number[],
    options: { select: readonly K[]; signal?: AbortSignal },
  ): Promise<CompareLoadResult<Pick<Product, K | 'id'>>>
}

export interface DummyJsonApi {
  getProducts: (params?: ProductListParams) => Promise<ProductsResponse>
  searchProducts: (q: string, params?: ProductListParams) => Promise<ProductsResponse>
  getProductsByCategory: (slug: string, params?: ProductListParams) => Promise<ProductsResponse>
  getProduct: (id: number, options?: { signal?: AbortSignal }) => Promise<Product>
  getCategories: () => Promise<Category[]>
  getAllProductSummaries: (
    scope: ProductScope,
    params?: Omit<ProductListParams, 'limit' | 'skip'>,
  ) => Promise<ProductsResponse<ProductSummary>>
  getProductsByIds: GetProductsByIds
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
  /**
   * Plusieurs produits par identifiants (comparateur, vus récemment, panier). DummyJSON n'a pas
   * de route groupée : un appel par produit, tous en parallèle. `allSettled` et pas `all` : un
   * produit supprimé (404) ou une erreur réseau n'empêche jamais d'afficher les autres.
   * Résultat dans l'ordre des identifiants, 404 (`missingIds`) séparés des autres échecs
   * (`failedIds`) : un produit introuvable se retire, une panne réseau se réessaie.
   * Stratégie et poids mesurés : docs/client-api.md.
   */
  async function getProductsByIds(
    ids: readonly number[],
    options: { select?: readonly (keyof Product)[]; signal?: AbortSignal } = {},
  ): Promise<CompareLoadResult<Product>> {
    // Un identifiant en double ne coûte pas un second appel.
    const unique = [...new Set(ids)]
    const query = options.select ? { select: options.select.join(',') } : undefined
    const results = await Promise.allSettled(
      unique.map((id) => request<Product>(`/products/${id}`, { query, signal: options.signal })),
    )
    return sortCompareResults(unique, results, httpStatusOf)
  }

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

    /**
     * Tous les produits d'une recherche ou d'une catégorie (`limit=0`), réduits aux champs
     * d'une carte (`select`). Pour les filtres que l'API ne sait pas faire : prix (#5),
     * recherche + catégorie (#3). Avec une recherche, la catégorie est filtrée par l'appelant.
     */
    getAllProductSummaries: (scope, params = {}) => {
      const query = { limit: 0, select: PRODUCT_SUMMARY_FIELDS.join(','), ...listQuery(params) }
      const options = { signal: params.signal }
      if (scope.q) {
        return request<ProductsResponse<ProductSummary>>('/products/search', {
          query: { q: scope.q, ...query },
          ...options,
        })
      }
      const path = scope.category
        ? `/products/category/${encodeURIComponent(scope.category)}`
        : '/products'
      return request<ProductsResponse<ProductSummary>>(path, { query, ...options })
    },

    // Avec `select`, l'API ne renvoie que les champs demandés : la surcharge de
    // `GetProductsByIds` donne alors le bon type (`Pick`) à l'appelant.
    getProductsByIds: getProductsByIds as GetProductsByIds,
  }
}
