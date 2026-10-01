/** Élément de la barre de pagination : un numéro de page ou une ellipse. */
export type PaginationItem = number | 'ellipsis'

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
