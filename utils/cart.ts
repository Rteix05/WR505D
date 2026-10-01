import type { CartLine } from '../types/promotions'
import type {
  CartCookie,
  CartItem,
  CartProduct,
  CartProductDetails,
  CartState,
  CartSyncResult,
  CartUpdate,
} from '../types/cart'
import { formatCents, toCents } from './price'

export const CART_COOKIE = 'cart'
export const CART_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/** Au-delà, le cookie risquerait de dépasser 4 Ko (vérifié par un test). */
export const MAX_CART_LINES = 30
export const MAX_PROMO_CODE_LENGTH = 32

function copies(count: number): string {
  return `${count} exemplaire${count > 1 ? 's' : ''}`
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function stockMessage(stock: number): string {
  return `Stock insuffisant : seulement ${copies(stock)} disponible${stock > 1 ? 's' : ''}. La quantité a été ajustée.`
}

/** Ajoute `quantity` exemplaires d'un produit, sans jamais dépasser son stock. */
export function addToCart(items: CartItem[], product: CartProduct, quantity = 1): CartUpdate {
  if (!isPositiveInteger(quantity)) {
    return { items, message: 'La quantité doit être un nombre entier d’au moins 1.' }
  }
  if (product.stock <= 0) {
    return { items, message: 'Ce produit est en rupture de stock.' }
  }

  const existing = items.find((item) => item.productId === product.id)
  if (!existing && items.length >= MAX_CART_LINES) {
    return {
      items,
      message: `Le panier est limité à ${MAX_CART_LINES} produits différents.`,
    }
  }

  const alreadyInCart = existing?.quantity ?? 0
  if (alreadyInCart >= product.stock) {
    return {
      items,
      message: `Vous avez déjà les ${copies(product.stock)} disponibles dans votre panier.`,
    }
  }

  const wanted = alreadyInCart + quantity
  const line: CartItem = {
    productId: product.id,
    quantity: Math.min(wanted, product.stock),
    // Prix, catégorie et stock repris du produit : ce sont les données les plus récentes.
    unitPriceCents: toCents(product.price),
    category: product.category,
    stock: product.stock,
  }

  return {
    items: existing
      ? items.map((item) => (item.productId === product.id ? line : item))
      : [...items, line],
    message: wanted > product.stock ? stockMessage(product.stock) : null,
  }
}

/** Remplace la quantité d'une ligne, bornée au stock. La suppression passe par `removeFromCart`. */
export function updateCartQuantity(
  items: CartItem[],
  productId: number,
  quantity: number,
): CartUpdate {
  const existing = items.find((item) => item.productId === productId)
  if (!existing) return { items, message: null }
  if (!isPositiveInteger(quantity)) {
    return { items, message: 'La quantité doit être un nombre entier d’au moins 1.' }
  }

  const bounded = Math.min(quantity, existing.stock)
  return {
    items: items.map((item) =>
      item.productId === productId ? { ...item, quantity: bounded } : item,
    ),
    message: quantity > existing.stock ? stockMessage(existing.stock) : null,
  }
}

export function removeFromCart(items: CartItem[], productId: number): CartItem[] {
  return items.filter((item) => item.productId !== productId)
}

/**
 * Met les lignes à jour avec les produits rechargés depuis l'API (prix, stock, catégorie).
 * Le cookie peut dater de plusieurs jours : on prévient l'utilisateur de chaque changement.
 * Un produit absent de `products` (API injoignable, produit supprimé) garde sa ligne telle quelle.
 */
export function syncCartWithProducts(
  items: CartItem[],
  products: CartProductDetails[],
): CartSyncResult {
  const messages: string[] = []
  const synced: CartItem[] = []

  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.productId)
    if (!product) {
      synced.push(item)
      continue
    }
    if (product.stock <= 0) {
      messages.push(`« ${product.title} » n'est plus en stock : il a été retiré du panier.`)
      continue
    }

    const unitPriceCents = toCents(product.price)
    if (unitPriceCents !== item.unitPriceCents) {
      messages.push(
        `Le prix de « ${product.title} » a changé : ${formatCents(item.unitPriceCents)} → ${formatCents(unitPriceCents)}.`,
      )
    }
    if (item.quantity > product.stock) {
      messages.push(
        `Il ne reste que ${copies(product.stock)} de « ${product.title} » : la quantité a été ajustée.`,
      )
    }
    synced.push({
      productId: item.productId,
      quantity: Math.min(item.quantity, product.stock),
      unitPriceCents,
      category: product.category,
      stock: product.stock,
    })
  }

  return { items: synced, messages }
}

/** Nombre total d'articles (quantités cumulées), pour le badge de l'en-tête. */
export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

/** Lignes au format attendu par `computeCart` (le stock n'y sert pas). */
export function toCartLines(items: CartItem[]): CartLine[] {
  return items.map(({ productId, category, unitPriceCents, quantity }) => ({
    productId,
    category,
    unitPriceCents,
    quantity,
  }))
}

export function normalizePromoCode(code: string): string {
  return code.trim().slice(0, MAX_PROMO_CODE_LENGTH)
}

export function serializeCart(state: CartState): CartCookie {
  return {
    items: state.items.map((item) => [
      item.productId,
      item.quantity,
      item.unitPriceCents,
      item.category,
      item.stock,
    ]),
    promoCode: state.promoCode,
  }
}

function parseCookieLine(value: unknown): CartItem | null {
  if (!Array.isArray(value) || value.length !== 5) return null
  const [productId, quantity, unitPriceCents, category, stock]: unknown[] = value
  if (
    !isPositiveInteger(productId) ||
    !isPositiveInteger(quantity) ||
    !isNonNegativeInteger(unitPriceCents) ||
    typeof category !== 'string' ||
    category === '' ||
    !isPositiveInteger(stock)
  ) {
    return null
  }
  return { productId, quantity: Math.min(quantity, stock), unitPriceCents, category, stock }
}

/**
 * Relit le cookie. Il vient du navigateur, donc il peut être absent, ancien ou modifié à la main :
 * tout ce qui n'est pas valide est ignoré au lieu de faire planter la page.
 */
export function parseCart(value: unknown): CartState {
  const empty: CartState = { items: [], promoCode: '' }
  if (typeof value !== 'object' || value === null) return empty

  const rawItems = 'items' in value && Array.isArray(value.items) ? value.items : []
  const items: CartItem[] = []
  for (const raw of rawItems) {
    const item = parseCookieLine(raw)
    const duplicate = item && items.some((kept) => kept.productId === item.productId)
    if (item && !duplicate && items.length < MAX_CART_LINES) items.push(item)
  }

  const rawCode = 'promoCode' in value ? value.promoCode : ''
  return { items, promoCode: typeof rawCode === 'string' ? normalizePromoCode(rawCode) : '' }
}
