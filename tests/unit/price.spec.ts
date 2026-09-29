import { describe, expect, it } from 'vitest'
import { formatCents, percentOfCents, toCents } from '../../utils/price'

describe('toCents', () => {
  it('convertit les prix DummyJSON sans erreur de virgule flottante', () => {
    expect(toCents(9.99)).toBe(999)
    expect(toCents(19.99)).toBe(1999)
    expect(toCents(0.29)).toBe(29)
  })
})

describe('formatCents', () => {
  it('formate en euros à la française', () => {
    expect(formatCents(1099).replace(/\s/g, ' ')).toBe('10,99 €')
  })
})

describe('percentOfCents', () => {
  it('arrondit demi vers le haut', () => {
    expect(percentOfCents(1995, 10)).toBe(200)
    expect(percentOfCents(1994, 10)).toBe(199)
    expect(percentOfCents(5997, 25)).toBe(1499)
  })
})
