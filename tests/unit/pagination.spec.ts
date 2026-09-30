import { describe, expect, it } from 'vitest'
import { paginationItems } from '../../utils/pagination'

describe('paginationItems', () => {
  it('affiche tout quand il y a peu de pages', () => {
    expect(paginationItems(1, 1)).toEqual([1])
    expect(paginationItems(2, 4)).toEqual([1, 2, 3, 4])
  })

  it('remplace les trous par une ellipse (17 pages)', () => {
    expect(paginationItems(1, 17)).toEqual([1, 2, 'ellipsis', 17])
    expect(paginationItems(9, 17)).toEqual([1, 'ellipsis', 8, 9, 10, 'ellipsis', 17])
    expect(paginationItems(17, 17)).toEqual([1, 'ellipsis', 16, 17])
  })

  it("n'utilise jamais d'ellipse pour cacher une seule page", () => {
    expect(paginationItems(4, 17)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 17])
    expect(paginationItems(14, 17)).toEqual([1, 'ellipsis', 13, 14, 15, 16, 17])
  })

  it('ignore une page courante hors bornes sans la montrer', () => {
    expect(paginationItems(99, 17)).toEqual([1, 'ellipsis', 17])
  })
})
