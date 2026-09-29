import { describe, expect, it } from 'vitest'
import { discountBadge, formatRating } from '../../utils/product'

describe('discountBadge', () => {
  it('arrondit le pourcentage à l’entier', () => {
    expect(discountBadge(10.48)).toBe('−10 %')
    expect(discountBadge(12.5)).toBe('−13 %')
  })

  it('pas de badge sous 1 %', () => {
    expect(discountBadge(0)).toBeNull()
    expect(discountBadge(0.49)).toBeNull()
    expect(discountBadge(0.5)).toBe('−1 %')
  })
})

describe('formatRating', () => {
  it('une décimale, virgule française', () => {
    expect(formatRating(4.56)).toBe('4,6')
    expect(formatRating(3)).toBe('3')
  })
})
