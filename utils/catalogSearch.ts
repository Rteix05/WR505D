import type { CatalogFilters } from '../types/catalog'
import type { Product, ProductsResponse } from '../types/dummyjson'
import { CATALOG_PAGE_SIZE } from './catalogQuery'

/** Délai entre la dernière frappe et la recherche : imposé par l'issue #3. */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * DummyJSON ne sait pas combiner une recherche et une catégorie (`/products/search`
 * ignore `category`). Dans ce cas seulement, on récupère tous les résultats de la
 * recherche et on filtre/pagine ici.
 */
export function needsLocalFiltering(filters: CatalogFilters): boolean {
  return filters.q !== '' && filters.category !== null
}

/** Garde les produits qui respectent les filtres que l'API n'a pas pu appliquer. */
export function filterLocally<P extends Pick<Product, 'category'>>(
  products: P[],
  filters: Pick<CatalogFilters, 'category'>,
): P[] {
  return products.filter(
    (product) => filters.category === null || product.category === filters.category,
  )
}

/** Découpe une liste déjà filtrée et triée en page, au même format que l'API. */
export function localPage(
  products: Product[],
  page: number,
  pageSize = CATALOG_PAGE_SIZE,
): ProductsResponse {
  const skip = (page - 1) * pageSize
  return {
    products: products.slice(skip, skip + pageSize),
    total: products.length,
    skip,
    limit: pageSize,
  }
}
