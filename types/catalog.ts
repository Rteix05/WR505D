// État du catalogue (/produits), lu et écrit dans les query params de l'URL.

/** Champs de tri acceptés par DummyJSON (`sortBy`). */
export type SortField = 'price' | 'rating' | 'title'

export type SortOrder = 'asc' | 'desc'

export interface CatalogFilters {
  /** Page courante, à partir de 1. */
  page: number
  /** Recherche plein texte (#3), chaîne vide si aucune. */
  q: string
  /** Slug de catégorie DummyJSON, ex. `beauty`. */
  category: string | null
  sortBy: SortField | null
  order: SortOrder
  /** Bornes de prix en euros (#5), incluses. */
  minPrice: number | null
  maxPrice: number | null
}

/** Query params tels qu'écrits dans l'URL : uniquement des chaînes. */
export type CatalogQuery = Partial<Record<keyof CatalogFilters, string>>

/** Une option du menu de tri, ex. { value: 'price-asc', label: 'Prix croissant' }. */
export interface SortOption {
  value: string
  label: string
  sortBy: SortField | null
  order: SortOrder
}
