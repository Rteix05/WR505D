import { describe, expect, it } from 'vitest'
import {
  COMPARE_MAX,
  formatCompareIds,
  isCanonicalCompareQuery,
  isSameCompareSelection,
  parseCompareIds,
  sortCompareResults,
  toggleCompare,
} from '../../utils/compare'

describe('parseCompareIds', () => {
  it('lit ?ids=3,17,42 dans l’ordre', () => {
    expect(parseCompareIds('3,17,42')).toEqual([3, 17, 42])
    expect(parseCompareIds('42,3,17')).toEqual([42, 3, 17])
  })

  it('ignore les doublons en gardant la première occurrence', () => {
    expect(parseCompareIds('5,5,5')).toEqual([5])
    expect(parseCompareIds('3,17,3,42')).toEqual([3, 17, 42])
  })

  it('s’arrête au maximum (3 par défaut, ou max fourni)', () => {
    expect(COMPARE_MAX).toBe(3)
    expect(parseCompareIds('1,2,3,4,5')).toEqual([1, 2, 3])
    expect(parseCompareIds('1,2,3,4,5', 2)).toEqual([1, 2])
  })

  it('les doublons ne comptent pas dans le maximum', () => {
    expect(parseCompareIds('1,1,2,2,3,4')).toEqual([1, 2, 3])
  })

  it('un identifiant invalide ne prend pas la place d’un valide', () => {
    expect(parseCompareIds('abc,1,x,2,3')).toEqual([1, 2, 3])
  })

  it.each([
    ['chaîne non numérique', 'abc', []],
    ['élément vide', '1,,2', [1, 2]],
    ['chaîne vide', '', []],
    ['négatif', '-1', []],
    ['décimal', '1.5', []],
    ['notation scientifique', '1e3', []],
    ['zéro', '0', []],
    ['trop grand pour être exact', '99999999999999999999', []],
    ['espaces autour', ' 3 , 17 ', [3, 17]],
    ['zéros devant', '007', [7]],
  ])('entrée invalide ou limite (%s)', (_label, raw, expected) => {
    expect(parseCompareIds(raw)).toEqual(expected)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['tableau vide', []],
    ['objet', { ids: '1,2' }],
    ['booléen', true],
  ])('valeur non exploitable (%s) : sélection vide, jamais d’erreur', (_label, raw) => {
    expect(parseCompareIds(raw)).toEqual([])
  })

  it('paramètre répété dans l’URL (tableau vue-router)', () => {
    expect(parseCompareIds(['3', '17'])).toEqual([3, 17])
    expect(parseCompareIds(['3,17', '42'])).toEqual([3, 17, 42])
    expect(parseCompareIds(['3', null, 'abc', '17'])).toEqual([3, 17])
  })

  it('cookie relu en JSON par useCookie (tableau de nombres)', () => {
    expect(parseCompareIds([3, 17, 42])).toEqual([3, 17, 42])
    expect(parseCompareIds([3, -1, 1.5, 17])).toEqual([3, 17])
  })
})

describe('toggleCompare', () => {
  it('ajoute en fin de sélection', () => {
    expect(toggleCompare([3], 17)).toEqual({ ids: [3, 17], rejected: false })
  })

  it('retire un produit déjà présent, en gardant l’ordre des autres', () => {
    expect(toggleCompare([3, 17, 42], 17)).toEqual({ ids: [3, 42], rejected: false })
  })

  it('comparateur plein : 4ᵉ produit refusé, sélection inchangée', () => {
    const ids = [3, 17, 42]
    const result = toggleCompare(ids, 8)
    expect(result).toEqual({ ids: [3, 17, 42], rejected: true })
    expect(result.ids).toBe(ids)
  })

  it('comparateur plein : retirer reste possible', () => {
    expect(toggleCompare([3, 17, 42], 3)).toEqual({ ids: [17, 42], rejected: false })
  })

  it('respecte le max fourni', () => {
    expect(toggleCompare([1, 2], 3, 2)).toEqual({ ids: [1, 2], rejected: true })
  })

  it.each([0, -1, 1.5, Number.NaN])(
    'identifiant invalide (%s) : rien ne change, ce n’est pas un refus « plein »',
    (id) => {
      expect(toggleCompare([3], id)).toEqual({ ids: [3], rejected: false })
    },
  )

  it('ne modifie pas le tableau reçu (fonction pure)', () => {
    const ids = [3, 17]
    toggleCompare(ids, 42)
    toggleCompare(ids, 3)
    expect(ids).toEqual([3, 17])
  })
})

describe('formatCompareIds', () => {
  it('écrit la valeur canonique de ?ids=', () => {
    expect(formatCompareIds([3, 17, 42])).toBe('3,17,42')
  })

  it('sélection vide : pas de paramètre', () => {
    expect(formatCompareIds([])).toBeNull()
  })

  it('aller-retour : relire la valeur écrite redonne la même sélection', () => {
    const ids = parseCompareIds(' 42,abc,3,3,,17,99 ')
    expect(ids).toEqual([42, 3, 17])
    expect(parseCompareIds(formatCompareIds(ids))).toEqual(ids)
  })
})

describe('isSameCompareSelection', () => {
  it('mêmes produits, ordre différent : même sélection', () => {
    expect(isSameCompareSelection([3, 17], [17, 3])).toBe(true)
  })

  it('produits ou nombre différents : sélection différente', () => {
    expect(isSameCompareSelection([3, 17], [3, 42])).toBe(false)
    expect(isSameCompareSelection([3], [3, 17])).toBe(false)
    expect(isSameCompareSelection([], [3])).toBe(false)
  })

  it('deux sélections vides : identiques', () => {
    expect(isSameCompareSelection([], [])).toBe(true)
  })
})

describe('isCanonicalCompareQuery', () => {
  it('forme canonique : rien à normaliser', () => {
    expect(isCanonicalCompareQuery('3,17,42', [3, 17, 42])).toBe(true)
    expect(isCanonicalCompareQuery(undefined, [])).toBe(true)
  })

  it.each([
    ['doublon', '3,3,17', [3, 17]],
    ['invalide', 'abc,3', [3]],
    ['espaces', ' 3,17', [3, 17]],
    ['élément vide', '3,,17', [3, 17]],
    ['paramètre répété', ['3', '17'], [3, 17]],
    ['paramètre vide', '', []],
    ['tout invalide', 'abc', []],
    ['produit inexistant retiré après chargement', '3,999999', [3]],
  ])('à normaliser (%s)', (_label, raw, ids) => {
    expect(isCanonicalCompareQuery(raw, ids)).toBe(false)
  })
})

describe('sortCompareResults', () => {
  const statusOf = (error: unknown): number | undefined =>
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number(error.statusCode)
      : undefined

  it('sépare produits chargés, inexistants (404) et échecs, dans l’ordre', () => {
    const results: PromiseSettledResult<string>[] = [
      { status: 'fulfilled', value: 'produit 3' },
      { status: 'rejected', reason: { statusCode: 404 } },
      { status: 'rejected', reason: new TypeError('fetch failed') },
      { status: 'fulfilled', value: 'produit 8' },
    ]
    expect(sortCompareResults([3, 999, 42, 8], results, statusOf)).toEqual({
      products: ['produit 3', 'produit 8'],
      missingIds: [999],
      failedIds: [42],
    })
  })

  it('une erreur serveur n’est pas un produit inexistant : il reste dans l’URL', () => {
    const results: PromiseSettledResult<string>[] = [
      { status: 'rejected', reason: { statusCode: 500 } },
    ]
    expect(sortCompareResults([3], results, statusOf)).toEqual({
      products: [],
      missingIds: [],
      failedIds: [3],
    })
  })

  it('aucun identifiant : rien à charger', () => {
    expect(sortCompareResults([], [], statusOf)).toEqual({
      products: [],
      missingIds: [],
      failedIds: [],
    })
  })
})
