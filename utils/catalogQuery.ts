import type {
  CatalogFilters,
  CatalogQuery,
  SortField,
  SortOption,
  SortOrder,
} from '../types/catalog'

export const CATALOG_PAGE_SIZE = 12
/**
 * Paramètre envoyé par le menu de tri du formulaire quand JavaScript est désactivé
 * (`?sort=price-desc`). Lu par `parseCatalogQuery`, jamais écrit par `toCatalogQuery` :
 * la page redirige vers l'URL canonique (`sortBy` + `order`).
 */
export const SORT_FORM_PARAM = 'sort'
export const SEARCH_MAX_LENGTH = 100

const SORT_FIELDS: readonly SortField[] = ['price', 'rating', 'title']
const SORT_ORDERS: readonly SortOrder[] = ['asc', 'desc']
/** Slug DummyJSON : minuscules, chiffres et tirets (ex. `mens-shirts`). */
const CATEGORY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const DEFAULT_FILTERS: Readonly<CatalogFilters> = {
  page: 1,
  q: '',
  category: null,
  sortBy: null,
  order: 'asc',
  minPrice: null,
  maxPrice: null,
}

/** Pas de tri : ordre par défaut de l'API, sans `sortBy`. */
export const RELEVANCE_SORT: SortOption = {
  value: 'relevance',
  label: 'Pertinence',
  sortBy: null,
  order: 'asc',
}

/** Options du menu de tri. */
export const SORT_OPTIONS: readonly SortOption[] = [
  RELEVANCE_SORT,
  { value: 'price-asc', label: 'Prix croissant', sortBy: 'price', order: 'asc' },
  { value: 'price-desc', label: 'Prix décroissant', sortBy: 'price', order: 'desc' },
  { value: 'rating-desc', label: 'Mieux notés', sortBy: 'rating', order: 'desc' },
  { value: 'rating-asc', label: 'Moins bien notés', sortBy: 'rating', order: 'asc' },
  { value: 'title-asc', label: 'Titre (A → Z)', sortBy: 'title', order: 'asc' },
  { value: 'title-desc', label: 'Titre (Z → A)', sortBy: 'title', order: 'desc' },
]

// --- Lecture de l'URL -------------------------------------------------------
// L'URL vient de l'utilisateur (lien partagé, saisie à la main) : chaque valeur
// est `unknown` et validée. Une valeur invalide est ignorée (valeur par défaut),
// elle ne fait jamais planter la page.

/** `?page=2&page=3` donne un tableau dans vue-router : on garde la première valeur. */
function firstString(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : undefined
}

function isOneOf<T extends string>(value: string | undefined, allowed: readonly T[]): value is T {
  return value !== undefined && (allowed as readonly string[]).includes(value)
}

/** Entier strictement positif écrit en chiffres uniquement (refuse `2.5`, `1e3`, `-1`). */
function parsePage(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) return DEFAULT_FILTERS.page
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 ? page : DEFAULT_FILTERS.page
}

/**
 * Prix en euros, positif ou nul, 2 décimales au plus (`10`, `10.5`, `10,50`).
 * Exportée pour les champs de prix (#5) : mêmes règles dans l'URL et dans le formulaire.
 */
export function parsePrice(value: string | undefined): number | null {
  if (value === undefined) return null
  const normalized = value.trim().replace(',', '.')
  // La regex n'accepte que des chiffres : Number() donne toujours un nombre fini.
  return /^\d+(?:\.\d{1,2})?$/.test(normalized) ? Number(normalized) : null
}

function parseSearch(value: string | undefined): string {
  return (value ?? '').trim().slice(0, SEARCH_MAX_LENGTH)
}

function parseCategory(value: string | undefined): string | null {
  return value !== undefined && CATEGORY_SLUG.test(value) ? value : null
}

/** Lit les filtres depuis `route.query`. Toujours un résultat valide. */
export function parseCatalogQuery(query: Record<string, unknown>): CatalogFilters {
  const sortByParam = firstString(query.sortBy)
  const orderParam = firstString(query.order)
  const urlSort = {
    sortBy: isOneOf(sortByParam, SORT_FIELDS) ? sortByParam : null,
    order: isOneOf(orderParam, SORT_ORDERS) ? orderParam : DEFAULT_FILTERS.order,
  }
  // Une option du menu (formulaire sans JavaScript) l'emporte sur sortBy / order.
  const formSort = SORT_OPTIONS.find(
    (option) => option.value === firstString(query[SORT_FORM_PARAM]),
  )
  const { sortBy, order } = formSort ?? urlSort
  let minPrice = parsePrice(firstString(query.minPrice))
  let maxPrice = parsePrice(firstString(query.maxPrice))

  // Bornes inversées (min 50, max 10) : l'intention est claire, on les remet dans l'ordre.
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    ;[minPrice, maxPrice] = [maxPrice, minPrice]
  }

  return {
    page: parsePage(firstString(query.page)),
    q: parseSearch(firstString(query.q)),
    category: parseCategory(firstString(query.category)),
    sortBy,
    order,
    minPrice,
    maxPrice,
  }
}

// --- Écriture dans l'URL ----------------------------------------------------

/**
 * Filtres → query params. Les valeurs par défaut sont omises et les clés sont
 * toujours dans le même ordre : une même vue a une seule URL (liens partagés
 * identiques, pas de contenu dupliqué pour les moteurs de recherche).
 */
export function toCatalogQuery(filters: CatalogFilters): CatalogQuery {
  const query: CatalogQuery = {}
  if (filters.q) query.q = filters.q
  if (filters.category) query.category = filters.category
  if (filters.sortBy) {
    query.sortBy = filters.sortBy
    query.order = filters.order
  }
  if (filters.minPrice !== null) query.minPrice = String(filters.minPrice)
  if (filters.maxPrice !== null) query.maxPrice = String(filters.maxPrice)
  if (filters.page > 1) query.page = String(filters.page)
  return query
}

/**
 * Applique un changement de filtres. Tout changement autre que la page renvoie
 * à la page 1 : la page 5 d'une ancienne recherche n'a pas de sens pour la nouvelle.
 */
export function updateFilters(
  current: CatalogFilters,
  changes: Partial<CatalogFilters>,
): CatalogFilters {
  const next = { ...current, ...changes }
  const onlyPage = Object.keys(changes).every((key) => key === 'page')
  return onlyPage ? next : { ...next, page: changes.page ?? DEFAULT_FILTERS.page }
}

/** Nombre de filtres actifs (hors page et tri), ex. pour un bouton « Effacer les filtres ». */
export function activeFilterCount(filters: CatalogFilters): number {
  return [
    filters.q !== '',
    filters.category !== null,
    filters.minPrice !== null,
    filters.maxPrice !== null,
  ].filter(Boolean).length
}

// --- Tri ------------------------------------------------------------------------

/** Option du menu correspondant aux filtres (Pertinence si aucun tri). */
export function sortOptionFor(filters: CatalogFilters): SortOption {
  return (
    SORT_OPTIONS.find(
      (option) =>
        option.sortBy === filters.sortBy &&
        (option.sortBy === null || option.order === filters.order),
    ) ?? RELEVANCE_SORT
  )
}

/** Valeur choisie dans le menu → champs de tri. Valeur inconnue = Pertinence. */
export function sortFromOption(value: string): Pick<CatalogFilters, 'sortBy' | 'order'> {
  const option = SORT_OPTIONS.find((candidate) => candidate.value === value) ?? RELEVANCE_SORT
  return { sortBy: option.sortBy, order: option.order }
}

// --- Pagination -------------------------------------------------------------------

export function pageCount(total: number, pageSize = CATALOG_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Ramène la page dans les bornes une fois le total connu (ex. `?page=99` sur 17 pages). */
export function clampPage(page: number, total: number, pageSize = CATALOG_PAGE_SIZE): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize))
}

/** Paramètres DummyJSON pour une page : `limit` et `skip`. */
export function paginationParams(
  page: number,
  pageSize = CATALOG_PAGE_SIZE,
): { limit: number; skip: number } {
  return { limit: pageSize, skip: (page - 1) * pageSize }
}

/** Paramètres de tri DummyJSON, vides si aucun tri (ordre par défaut de l'API). */
export function sortParams(
  filters: CatalogFilters,
): { sortBy: SortField; order: SortOrder } | Record<string, never> {
  return filters.sortBy ? { sortBy: filters.sortBy, order: filters.order } : {}
}
