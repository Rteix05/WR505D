import { describe, expect, it } from 'vitest'
import {
  CART_COOKIE,
  MAX_CART_LINES,
  addToCart,
  cartItemCount,
  normalizePromoCode,
  parseCart,
  removeFromCart,
  serializeCart,
  syncCartWithProducts,
  toCartLines,
  updateCartQuantity,
} from '../../utils/cart'
import { computeCart } from '../../utils/promotions'
import type { CartItem, CartProduct, CartProductDetails } from '../../types/cart'

function product(overrides: Partial<CartProduct> = {}): CartProduct {
  return { id: 1, price: 9.99, category: 'beauty', stock: 5, ...overrides }
}

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 1,
    quantity: 1,
    unitPriceCents: 999,
    category: 'beauty',
    stock: 5,
    ...overrides,
  }
}

describe('addToCart', () => {
  it('ajoute une nouvelle ligne avec le prix converti en centimes', () => {
    expect(addToCart([], product(), 2)).toEqual({
      items: [item({ quantity: 2 })],
      message: null,
    })
  })

  it('cumule la quantité si le produit est déjà dans le panier', () => {
    const { items } = addToCart([item({ quantity: 2 })], product(), 1)
    expect(items).toEqual([item({ quantity: 3 })])
  })

  it('ne dépasse jamais le stock et explique pourquoi', () => {
    const result = addToCart([item({ quantity: 4 })], product({ stock: 5 }), 3)
    expect(result.items[0]?.quantity).toBe(5)
    expect(result.message).toBe(
      'Stock insuffisant : seulement 5 exemplaires disponibles. La quantité a été ajustée.',
    )
  })

  it('stock de 1 : message au singulier', () => {
    const result = addToCart([], product({ stock: 1 }), 2)
    expect(result.message).toContain('seulement 1 exemplaire disponible.')
  })

  it('stock déjà atteint : panier inchangé, message', () => {
    const items = [item({ quantity: 5 })]
    const result = addToCart(items, product({ stock: 5 }))
    expect(result.items).toBe(items)
    expect(result.message).toBe('Vous avez déjà les 5 exemplaires disponibles dans votre panier.')
  })

  it('rupture de stock : rien n’est ajouté', () => {
    const result = addToCart([], product({ stock: 0 }))
    expect(result.items).toEqual([])
    expect(result.message).toBe('Ce produit est en rupture de stock.')
  })

  it.each([0, -1, 1.5, Number.NaN])('quantité invalide (%s) : rien n’est ajouté', (quantity) => {
    const result = addToCart([], product(), quantity)
    expect(result.items).toEqual([])
    expect(result.message).not.toBeNull()
  })

  it('met à jour prix, catégorie et stock avec les données les plus récentes', () => {
    const { items } = addToCart(
      [item({ quantity: 1, unitPriceCents: 999, stock: 5 })],
      product({ price: 12.5, stock: 8 }),
    )
    expect(items[0]).toEqual(item({ quantity: 2, unitPriceCents: 1250, stock: 8 }))
  })

  it(`refuse un ${MAX_CART_LINES + 1}e produit différent`, () => {
    const full = Array.from({ length: MAX_CART_LINES }, (_, i) => item({ productId: i + 1 }))
    const result = addToCart(full, product({ id: 999 }))
    expect(result.items).toBe(full)
    expect(result.message).toContain(`${MAX_CART_LINES} produits différents`)
  })

  it('panier plein : on peut encore augmenter une ligne existante', () => {
    const full = Array.from({ length: MAX_CART_LINES }, (_, i) => item({ productId: i + 1 }))
    const result = addToCart(full, product({ id: 1 }))
    expect(result.items[0]?.quantity).toBe(2)
    expect(result.message).toBeNull()
  })

  it('ne modifie pas le tableau reçu', () => {
    const items = [item()]
    const copy = structuredClone(items)
    addToCart(items, product(), 2)
    expect(items).toEqual(copy)
  })
})

describe('updateCartQuantity', () => {
  it('remplace la quantité', () => {
    expect(updateCartQuantity([item()], 1, 3)).toEqual({
      items: [item({ quantity: 3 })],
      message: null,
    })
  })

  it('borne au stock avec un message', () => {
    const result = updateCartQuantity([item({ stock: 4 })], 1, 10)
    expect(result.items[0]?.quantity).toBe(4)
    expect(result.message).toContain('seulement 4 exemplaires')
  })

  it.each([0, -3, 2.5])('quantité invalide (%s) : ligne inchangée, message', (quantity) => {
    const items = [item({ quantity: 2 })]
    const result = updateCartQuantity(items, 1, quantity)
    expect(result.items).toBe(items)
    expect(result.message).toContain('au moins 1')
  })

  it('produit absent : rien ne change', () => {
    const items = [item()]
    expect(updateCartQuantity(items, 42, 2)).toEqual({ items, message: null })
  })
})

describe('removeFromCart, cartItemCount, toCartLines', () => {
  const items = [item({ productId: 1, quantity: 2 }), item({ productId: 2, quantity: 3 })]

  it('retire la ligne demandée', () => {
    expect(removeFromCart(items, 1)).toEqual([items[1]])
  })

  it('compte les articles, pas les lignes', () => {
    expect(cartItemCount(items)).toBe(5)
    expect(cartItemCount([])).toBe(0)
  })

  it('produit des lignes utilisables par computeCart', () => {
    const lines = toCartLines([item({ quantity: 3 })])
    expect(lines).toEqual([{ productId: 1, category: 'beauty', unitPriceCents: 999, quantity: 3 }])
    // Scénario 1 du sujet : 3 × beauty à 9,99 sans code
    expect(computeCart(lines).totalCents).toBe(3187)
  })
})

describe('cookie : serializeCart et parseCart', () => {
  it('aller-retour sans perte', () => {
    const state = { items: [item({ quantity: 2 }), item({ productId: 7 })], promoCode: 'TROYES10' }
    expect(parseCart(serializeCart(state))).toEqual(state)
  })

  it('stocke les lignes en tuples compacts', () => {
    expect(serializeCart({ items: [item()], promoCode: '' })).toEqual({
      items: [[1, 1, 999, 'beauty', 5]],
      promoCode: '',
    })
  })

  it('reste sous 4 Ko dans le pire cas (panier plein, encodage de useCookie)', () => {
    const items = Array.from({ length: MAX_CART_LINES }, (_, i) =>
      item({
        productId: 190 + i,
        quantity: 100,
        unitPriceCents: 999_999,
        category: 'sports-accessories',
        stock: 100,
      }),
    )
    const state = { items, promoCode: 'X'.repeat(32) }
    // useCookie sérialise en JSON puis encode avec encodeURIComponent
    const header = `${CART_COOKIE}=${encodeURIComponent(JSON.stringify(serializeCart(state)))}`
    expect(header.length).toBeLessThan(4096)
  })

  it.each([
    ['absent', undefined],
    ['null', null],
    ['chaîne', 'n’importe quoi'],
    ['items non tableau', { items: 'x' }],
  ])('cookie illisible (%s) : panier vide', (_label, value) => {
    expect(parseCart(value)).toEqual({ items: [], promoCode: '' })
  })

  it('ignore les lignes invalides et garde les autres', () => {
    const state = parseCart({
      items: [
        [1, 2, 999, 'beauty', 5],
        [2, 0, 999, 'beauty', 5], // quantité nulle
        [3, 1, -1, 'beauty', 5], // prix négatif
        [4, 1, 999, '', 5], // catégorie vide
        [5, 1, 999, 'beauty', 0], // plus de stock
        ['6', 1, 999, 'beauty', 5], // id non numérique
        [7, 1, 999, 'beauty'], // champ manquant
        { productId: 8 }, // ancien format
        [1, 9, 999, 'beauty', 5], // doublon
      ],
      promoCode: 'TROYES10',
    })
    expect(state).toEqual({ items: [item({ quantity: 2 })], promoCode: 'TROYES10' })
  })

  it('ramène une quantité modifiée à la main au stock', () => {
    expect(parseCart({ items: [[1, 50, 999, 'beauty', 5]] }).items[0]?.quantity).toBe(5)
  })

  it(`ne garde que ${MAX_CART_LINES} lignes`, () => {
    const raw = Array.from({ length: 40 }, (_, i) => [i + 1, 1, 100, 'beauty', 5])
    expect(parseCart({ items: raw }).items).toHaveLength(MAX_CART_LINES)
  })

  it('code promo : type vérifié, espaces retirés, longueur limitée', () => {
    expect(parseCart({ items: [], promoCode: 42 }).promoCode).toBe('')
    expect(parseCart({ items: [], promoCode: ' troyes10 ' }).promoCode).toBe('troyes10')
    expect(normalizePromoCode('A'.repeat(50))).toHaveLength(32)
  })
})

describe('syncCartWithProducts', () => {
  function details(overrides: Partial<CartProductDetails> = {}): CartProductDetails {
    return { ...product(), title: 'Mascara', thumbnail: 'https://cdn/x.webp', ...overrides }
  }

  it('rien n’a changé : lignes identiques, aucun message', () => {
    const items = [item({ quantity: 2 })]
    expect(syncCartWithProducts(items, [details()])).toEqual({ items, messages: [] })
  })

  it('prix modifié : ligne mise à jour et message', () => {
    const result = syncCartWithProducts([item()], [details({ price: 12.5 })])
    expect(result.items[0]?.unitPriceCents).toBe(1250)
    expect(result.messages[0]?.replace(/\s/g, ' ')).toBe(
      'Le prix de « Mascara » a changé : 9,99 € → 12,50 €.',
    )
  })

  it('stock réduit : quantité ramenée au stock et message', () => {
    const result = syncCartWithProducts([item({ quantity: 5 })], [details({ stock: 2 })])
    expect(result.items[0]).toEqual(item({ quantity: 2, stock: 2 }))
    expect(result.messages).toEqual([
      'Il ne reste que 2 exemplaires de « Mascara » : la quantité a été ajustée.',
    ])
  })

  it('rupture : ligne retirée et message', () => {
    const result = syncCartWithProducts([item()], [details({ stock: 0 })])
    expect(result.items).toEqual([])
    expect(result.messages[0]).toContain("n'est plus en stock")
  })

  it('produit non rechargé (API injoignable) : ligne gardée telle quelle', () => {
    const items = [item({ productId: 42 })]
    expect(syncCartWithProducts(items, [details()])).toEqual({ items, messages: [] })
  })
})
