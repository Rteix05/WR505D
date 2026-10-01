import type { CatalogFilters } from '../types/catalog'
import type { Product, ProductsResponse } from '../types/dummyjson'
import { CATALOG_PAGE_SIZE } from './catalogQuery'
import { hasPriceFilter, inPriceRange } from './priceFilter'

/** Délai entre la dernière frappe et la recherche : imposé par l'issue #3. */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * Filtres que l'API ne sait pas appliquer : recherche + catégorie (`/products/search`
 * ignore `category`, #3) et prix (aucun paramètre de prix, #5). Dans ces cas seulement,
 * on récupère tous les produits concernés et on filtre/pagine ici.
 */
export function needsLocalFiltering(filters: CatalogFilters): boolean {
  return (filters.q !== '' && filters.category !== null) || hasPriceFilter(filters)
}

/** Garde les produits qui respectent les filtres que l'API n'a pas pu appliquer. */
export function filterLocally<P extends Pick<Product, 'category' | 'price'>>(
  products: P[],
  filters: Pick<CatalogFilters, 'category' | 'minPrice' | 'maxPrice'>,
): P[] {
  return products.filter(
    (product) =>
      (filters.category === null || product.category === filters.category) &&
      inPriceRange(product.price, filters),
  )
}

/** Découpe une liste déjà filtrée et triée en page, au même format que l'API. */
export function localPage<P>(
  products: P[],
  page: number,
  pageSize = CATALOG_PAGE_SIZE,
): ProductsResponse<P> {
  const skip = (page - 1) * pageSize
  return {
    products: products.slice(skip, skip + pageSize),
    total: products.length,
    skip,
    limit: pageSize,
  }
}
