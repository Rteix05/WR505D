import { describe, expect, it } from 'vitest'
import {
  discountReason,
  freeShippingRemainingCents,
  lineBeautyDiscountCents,
} from '../../utils/cartDetails'
import { toCartLines } from '../../utils/cart'
import { computeCart } from '../../utils/promotions'
import type { CartItem } from '../../types/cart'

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 1,
    quantity: 1,
    unitPriceCents: 999,
    category: 'beauty',
    stock: 50,
    ...overrides,
  }
}

function summaryOf(items: CartItem[], code?: string) {
  return computeCart(toCartLines(items), code)
}

describe('discountReason', () => {
  it('remise beauté : rappelle la règle', () => {
    const [beauty] = summaryOf([item({ quantity: 3 })]).discounts
    expect(beauty && discountReason(beauty)).toBe(
      '-10 % sur chaque article beauté, dès 3 articles beauté dans le panier.',
    )
  })

  it('code plein : rappelle le seuil', () => {
    const summary = summaryOf([item({ category: 'groceries', unitPriceCents: 6000 })], 'TROYES10')
    const code = summary.discounts.find((discount) => discount.id === 'TROYES10')
    expect(code && discountReason(code)).toMatch(
      /^10,00\s€ de réduction pour un sous-total supérieur à 50,00\s€/,
    )
  })

  it('code plafonné (scénario 2 du sujet) : explique la réduction', () => {
    const summary = summaryOf([item({ quantity: 3, unitPriceCents: 1999 })], 'TROYES10')
    const code = summary.discounts.find((discount) => discount.id === 'TROYES10')
    expect(code?.amountCents).toBe(899)
    expect(code && discountReason(code)).toMatch(
      /^Code réduit à 8,99\s€ : .*25 % du montant brut\.$/,
    )
  })
})

describe('lineBeautyDiscountCents', () => {
  it('la somme des parts par ligne égale la remise beauté de computeCart', () => {
    const items = [
      item({ productId: 1, quantity: 1, unitPriceCents: 5 }),
      item({ productId: 2, quantity: 1, unitPriceCents: 5 }),
      item({ productId: 3, quantity: 1, unitPriceCents: 5 }),
      item({ productId: 4, quantity: 2, unitPriceCents: 665 }),
    ]
    const summary = summaryOf(items)
    const perLine = items.reduce((sum, line) => sum + lineBeautyDiscountCents(line, summary), 0)
    expect(perLine).toBe(summary.discounts[0]?.amountCents)
  })

  it('0 pour une ligne non beauté', () => {
    const groceries = item({ productId: 2, category: 'groceries' })
    const items = [item({ quantity: 3 }), groceries]
    expect(lineBeautyDiscountCents(groceries, summaryOf(items))).toBe(0)
  })

  it('0 si la remise beauté ne s’applique pas (moins de 3 articles)', () => {
    const beauty = item({ quantity: 2 })
    expect(lineBeautyDiscountCents(beauty, summaryOf([beauty]))).toBe(0)
  })
})

describe('freeShippingRemainingCents', () => {
  it('indique le montant manquant après remises', () => {
    const items = [item({ category: 'groceries', unitPriceCents: 6000 })]
    // 60,00 - 10,00 de code = 50,00 : il manque 30,00
    expect(freeShippingRemainingCents(items, summaryOf(items, 'TROYES10'))).toBe(3000)
  })

  it('null si la livraison est déjà offerte', () => {
    const items = [item({ category: 'groceries', unitPriceCents: 8000 })]
    expect(freeShippingRemainingCents(items, summaryOf(items))).toBeNull()
  })

  it('null avec un produit furniture (jamais offerte)', () => {
    const items = [item({ category: 'furniture', unitPriceCents: 1000 })]
    expect(freeShippingRemainingCents(items, summaryOf(items))).toBeNull()
  })

  it('null pour un panier vide', () => {
    expect(freeShippingRemainingCents([], summaryOf([]))).toBeNull()
  })
})
