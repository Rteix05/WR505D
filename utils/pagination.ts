/** Élément de la barre de pagination : un numéro de page ou une ellipse. */
export type PaginationItem = number | 'ellipsis'

/**
 * Lit `?page=` : entier ≥ 1 écrit en chiffres, sinon 1. Une URL modifiée à la main
 * (`?page=abc`, `?page=-2`, `?page=1.5`) ne doit jamais faire planter la page.
 * À remplacer par `parseCatalogQuery` (#4) une fois mergée.
 */
export function pageFromQuery(value: unknown): number {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first !== 'string' || !/^\d+$/.test(first)) return 1
  const page = Number(first)
  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

/**
 * Pages à afficher : la première, la dernière, la courante et ses voisines,
 * les trous remplacés par une ellipse. 17 pages, page 9 → 1 … 8 9 10 … 17.
 * Une ellipse ne cache jamais une seule page : on affiche la page elle-même,
 * elle prend la même place et évite un clic inutile.
 */
export function paginationItems(current: number, totalPages: number): PaginationItem[] {
  const pages = new Set([1, totalPages, current - 1, current, current + 1])
  const visible = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)

  const items: PaginationItem[] = []
  let previous = 0
  for (const page of visible) {
    if (page - previous === 2) items.push(previous + 1)
    else if (page - previous > 2) items.push('ellipsis')
    items.push(page)
    previous = page
  }
  return items
}
