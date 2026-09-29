import { describe, expect, it } from 'vitest'
import { computeCart, type CartLine, type CartSummary } from '../../utils/promotions'

let nextId = 1
function line(quantity: number, category: string, unitPriceCents: number): CartLine {
  return { productId: nextId++, category, unitPriceCents, quantity }
}

/** Résumé comparable au tableau du sujet : Brut, Beauté, Code, Livraison, Total. */
function row(summary: CartSummary) {
  const amount = (id: string): number | null =>
    summary.discounts.find((discount) => discount.id === id)?.amountCents ?? null
  return {
    gross: summary.grossCents,
    beauty: amount('BEAUTY_3'),
    code: amount('TROYES10'),
    shipping: summary.shippingCents,
    total: summary.totalCents,
  }
}

describe('computeCart : scénarios d’acceptation du sujet', () => {
  it('1. 3 × beauty à 9,99, sans code', () => {
    expect(row(computeCart([line(3, 'beauty', 999)]))).toEqual({
      gross: 2997,
      beauty: 300,
      code: null,
      shipping: 490,
      total: 3187,
    })
  })

  it('2. 3 × beauty à 19,99, TROYES10 : le code est plafonné', () => {
    const summary = computeCart([line(3, 'beauty', 1999)], 'TROYES10')
    expect(row(summary)).toEqual({
      gross: 5997,
      beauty: 600,
      code: 899,
      shipping: 490,
      total: 4988,
    })
    expect(summary.messages).toHaveLength(1)
    expect(summary.messages[0]).toContain('25 %')
  })

  it('3. 1 × beauty à 39,00 + 1 × groceries à 15,00, TROYES10', () => {
    const summary = computeCart([line(1, 'beauty', 3900), line(1, 'groceries', 1500)], 'TROYES10')
    expect(row(summary)).toEqual({
      gross: 5400,
      beauty: null,
      code: 1000,
      shipping: 490,
      total: 4890,
    })
  })

  it('4. 1 × furniture à 89,99, TROYES10 : livraison payante', () => {
    expect(row(computeCart([line(1, 'furniture', 8999)], 'TROYES10'))).toEqual({
      gross: 8999,
      beauty: null,
      code: 1000,
      shipping: 490,
      total: 8489,
    })
  })

  it('5. 2 × laptops à 45,00, TROYES10 : livraison offerte à 80,00 pile', () => {
    expect(row(computeCart([line(2, 'laptops', 4500)], 'TROYES10'))).toEqual({
      gross: 9000,
      beauty: null,
      code: 1000,
      shipping: 0,
      total: 8000,
    })
  })

  it('6. 4 × beauty à 12,50, TROYES10 : code refusé (45,00 après remise beauté)', () => {
    const summary = computeCart([line(4, 'beauty', 1250)], 'TROYES10')
    expect(row(summary)).toEqual({
      gross: 5000,
      beauty: 500,
      code: null,
      shipping: 490,
      total: 4990,
    })
    expect(summary.messages).toHaveLength(1)
    expect(summary.messages[0]).toContain('refusé')
  })

  it('7. 2 × groceries à 30,00, " troyes10 " : casse et espaces ignorés', () => {
    const summary = computeCart([line(2, 'groceries', 3000)], ' troyes10 ')
    expect(row(summary)).toEqual({
      gross: 6000,
      beauty: null,
      code: 1000,
      shipping: 490,
      total: 5490,
    })
    expect(summary.messages).toEqual([])
  })

  it('8. 1 × groceries à 79,99, sans code', () => {
    expect(row(computeCart([line(1, 'groceries', 7999)]))).toEqual({
      gross: 7999,
      beauty: null,
      code: null,
      shipping: 490,
      total: 8489,
    })
  })
})

describe('computeCart : cas limites', () => {
  it('panier vide : tout à zéro, pas de livraison', () => {
    expect(computeCart([])).toEqual({
      grossCents: 0,
      discounts: [],
      shippingCents: 0,
      totalCents: 0,
      messages: [],
    })
  })

  it('panier vide avec code : code refusé, message explicatif', () => {
    const summary = computeCart([], 'TROYES10')
    expect(summary.discounts).toEqual([])
    expect(summary.messages).toHaveLength(1)
  })

  it('code inconnu : aucune remise, message explicatif', () => {
    const summary = computeCart([line(2, 'groceries', 3000)], 'promo2024')
    expect(summary.discounts).toEqual([])
    expect(summary.messages).toEqual(["Le code « PROMO2024 » n'existe pas."])
  })

  it('code vide ou composé d’espaces : ignoré sans message', () => {
    expect(computeCart([line(2, 'groceries', 3000)], '   ').messages).toEqual([])
    expect(computeCart([line(2, 'groceries', 3000)], '').messages).toEqual([])
  })

  it('lignes à quantité 0, négative ou non entière : ignorées', () => {
    const summary = computeCart([
      line(0, 'beauty', 1000),
      line(-2, 'beauty', 1000),
      line(1.5, 'beauty', 1000),
      line(1, 'groceries', 1000),
    ])
    expect(summary.grossCents).toBe(1000)
    expect(summary.discounts).toEqual([])
  })

  it('ligne à prix négatif ou non entier : ignorée', () => {
    const summary = computeCart([line(1, 'groceries', -500), line(1, 'groceries', 99.5)])
    expect(summary.grossCents).toBe(0)
    expect(summary.shippingCents).toBe(0)
  })

  it('les quantités 0 ne comptent pas pour la remise beauté', () => {
    const summary = computeCart([line(2, 'beauty', 1000), line(0, 'beauty', 1000)])
    expect(summary.discounts).toEqual([])
  })

  it('remise beauté : 2 articles ne suffisent pas', () => {
    expect(computeCart([line(2, 'beauty', 1000)]).discounts).toEqual([])
  })

  it('remise beauté cumulée sur plusieurs lignes, arrondie ligne par ligne', () => {
    // 3 lignes à 0,05 : 0,005 → 0,01 par ligne, soit 0,03 (un arrondi global donnerait 0,02)
    const summary = computeCart([line(1, 'beauty', 5), line(1, 'beauty', 5), line(1, 'beauty', 5)])
    expect(summary.discounts[0]?.amountCents).toBe(3)
  })

  it('remise beauté : arrondi demi vers le haut (3 × 6,65 = 19,95 → 2,00)', () => {
    expect(computeCart([line(3, 'beauty', 665)]).discounts[0]?.amountCents).toBe(200)
  })

  it('remise beauté : seules les lignes beauty sont remisées', () => {
    const summary = computeCart([line(3, 'beauty', 1000), line(1, 'groceries', 5000)])
    expect(summary.discounts[0]?.amountCents).toBe(300)
  })

  it('code refusé à 50,00 pile (strictement supérieur exigé)', () => {
    const summary = computeCart([line(1, 'groceries', 5000)], 'TROYES10')
    expect(summary.discounts).toEqual([])
    expect(summary.messages).toHaveLength(1)
  })

  it('code accepté à 50,01', () => {
    const summary = computeCart([line(1, 'groceries', 5001)], 'TROYES10')
    expect(summary.discounts).toEqual([
      { id: 'TROYES10', label: 'Code TROYES10', amountCents: 1000 },
    ])
  })

  it('plafond sans code : la remise beauté seule n’est jamais réduite', () => {
    const summary = computeCart([line(3, 'beauty', 1000)])
    expect(summary.discounts[0]?.amountCents).toBe(300)
    expect(summary.messages).toEqual([])
  })

  it('livraison : 79,99 après remises reste payante, 80,00 est offerte', () => {
    expect(computeCart([line(1, 'groceries', 8999)], 'TROYES10').shippingCents).toBe(490)
    expect(computeCart([line(1, 'groceries', 8000)]).shippingCents).toBe(0)
  })

  it('livraison : un seul produit furniture suffit à la rendre payante', () => {
    const summary = computeCart([line(1, 'groceries', 20000), line(1, 'furniture', 1000)])
    expect(summary.shippingCents).toBe(490)
  })

  it('ne modifie pas les lignes reçues (fonction pure)', () => {
    const lines = [line(3, 'beauty', 1999)]
    const copy = structuredClone(lines)
    computeCart(lines, 'TROYES10')
    expect(lines).toEqual(copy)
  })
})
