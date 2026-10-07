import { describe, expect, it } from 'vitest'
import {
  RECENTLY_VIEWED_MAX,
  parseRecentlyViewedCookie,
  pushRecentlyViewed,
  serializeRecentlyViewed,
} from '../../utils/recentlyViewed'

/** [1, 2, …, n] */
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1)

describe('pushRecentlyViewed', () => {
  it('historique vide : le produit visité devient le seul', () => {
    expect(pushRecentlyViewed([], 12)).toEqual([12])
  })

  it('nouveau produit : ajouté en tête, ordre des autres conservé', () => {
    expect(pushRecentlyViewed([3, 2, 1], 4)).toEqual([4, 3, 2, 1])
  })

  it('produit déjà vu : il remonte en tête, sans doublon', () => {
    expect(pushRecentlyViewed([3, 2, 1], 1)).toEqual([1, 3, 2])
    expect(pushRecentlyViewed([3, 2, 1], 3)).toEqual([3, 2, 1])
  })

  it(`dépassement : ${RECENTLY_VIEWED_MAX} maximum, le plus ancien sort`, () => {
    const full = range(RECENTLY_VIEWED_MAX) // [1…10], 10 = le plus ancien
    const result = pushRecentlyViewed(full, 42)
    expect(result).toHaveLength(RECENTLY_VIEWED_MAX)
    expect(result[0]).toBe(42)
    expect(result).not.toContain(RECENTLY_VIEWED_MAX)
  })

  it('historique plein, produit déjà présent : rien ne sort', () => {
    const full = range(RECENTLY_VIEWED_MAX)
    expect(pushRecentlyViewed(full, 10)).toEqual([10, ...range(9)])
  })

  it('max personnalisé', () => {
    expect(pushRecentlyViewed([3, 2, 1], 4, 2)).toEqual([4, 3])
    expect(pushRecentlyViewed([3, 2, 1], 4, 0)).toEqual([])
  })

  it.each([0, -1, 1.5, Number.NaN])('identifiant invalide (%s) : historique inchangé', (id) => {
    expect(pushRecentlyViewed([3, 2, 1], id)).toEqual([3, 2, 1])
  })

  it('ne modifie pas le tableau reçu', () => {
    const ids = [3, 2, 1]
    pushRecentlyViewed(ids, 1)
    expect(ids).toEqual([3, 2, 1])
  })
})

describe('parseRecentlyViewedCookie', () => {
  it('format écrit par le site : "12,5,3"', () => {
    expect(parseRecentlyViewedCookie('12,5,3')).toEqual([12, 5, 3])
  })

  it('un seul produit : useCookie donne un nombre', () => {
    expect(parseRecentlyViewedCookie(12)).toEqual([12])
  })

  it('tableau JSON (décodé par useCookie ou non)', () => {
    expect(parseRecentlyViewedCookie([12, 5])).toEqual([12, 5])
    expect(parseRecentlyViewedCookie(['12', '5'])).toEqual([12, 5])
    expect(parseRecentlyViewedCookie('[12,5]')).toEqual([12, 5])
  })

  it('"5,5,5" : doublons retirés', () => {
    expect(parseRecentlyViewedCookie('5,5,5')).toEqual([5])
  })

  it('doublons : la première occurrence (la plus récente) est gardée', () => {
    expect(parseRecentlyViewedCookie('3,1,3,2')).toEqual([3, 1, 2])
  })

  it('"1,,2" : valeur vide ignorée', () => {
    expect(parseRecentlyViewedCookie('1,,2')).toEqual([1, 2])
  })

  it('valeurs non numériques ignorées, les bonnes gardées', () => {
    expect(parseRecentlyViewedCookie('7,abc,-1,0,1.5,1e3, 8 ,x9')).toEqual([7, 8])
    expect(parseRecentlyViewedCookie([7, 'abc', null, {}, 2.5, true, 9])).toEqual([7, 9])
  })

  it(`plus de ${RECENTLY_VIEWED_MAX} identifiants : les ${RECENTLY_VIEWED_MAX} premiers`, () => {
    expect(parseRecentlyViewedCookie(range(15).join(','))).toEqual(range(RECENTLY_VIEWED_MAX))
  })

  it('identifiant trop grand pour être exact : ignoré', () => {
    expect(parseRecentlyViewedCookie('99999999999999999999,4')).toEqual([4])
  })

  // Aucun de ces cas ne doit lever d'erreur : historique vide.
  it.each([
    ['"abc"', 'abc'],
    ['tableau vide', []],
    ['null', null],
    ['undefined (cookie absent)', undefined],
    ['chaîne vide', ''],
    ['JSON invalide', '[1,'],
    ['JSON qui n’est pas un tableau', '{"ids":[1]}'],
    ['objet', { 0: 1 }],
    ['booléen', true],
    ['nombre invalide', -4],
  ])('%s : historique vide, sans erreur', (_label, raw) => {
    expect(parseRecentlyViewedCookie(raw)).toEqual([])
  })
})

describe('serializeRecentlyViewed', () => {
  it('aller-retour sans perte', () => {
    const ids = [12, 5, 3]
    expect(parseRecentlyViewedCookie(serializeRecentlyViewed(ids))).toEqual(ids)
  })

  it('historique plein : quelques dizaines d’octets', () => {
    // Pire cas réaliste : 10 identifiants à 3 chiffres (DummyJSON en compte 194).
    const worst = range(RECENTLY_VIEWED_MAX).map((i) => 190 + i)
    expect(serializeRecentlyViewed(worst).length).toBeLessThan(50)
  })

  it('historique vide : chaîne vide', () => {
    expect(serializeRecentlyViewed([])).toBe('')
  })
})
