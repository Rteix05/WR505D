import { defineStore } from 'pinia'
import type { CartItem, CartProduct } from '~/types/cart'
import type { CartSummary } from '~/types/promotions'

export const useCartStore = defineStore('cart', () => {
  // Le cookie est lu pendant le rendu serveur : le panier est déjà là dans le HTML.
  // `unknown` car il vient du navigateur : parseCart le valide avant de s'en servir.
  const cookie = useCookie<unknown>(CART_COOKIE, {
    path: '/',
    sameSite: 'lax',
    secure: !import.meta.dev,
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
  })
  const initial = parseCart(cookie.value)

  const items = ref<CartItem[]>(initial.items)
  const promoCode = ref<string>(initial.promoCode)

  const itemCount = computed((): number => cartItemCount(items.value))
  const isEmpty = computed((): boolean => items.value.length === 0)
  // Toujours recalculé à partir des lignes : jamais de total stocké qui pourrait être faux.
  const summary = computed((): CartSummary =>
    computeCart(toCartLines(items.value), promoCode.value),
  )

  function persist(): void {
    cookie.value = serializeCart({ items: items.value, promoCode: promoCode.value })
  }

  /** Ajoute un produit ; renvoie le message à afficher (stock atteint…) ou `null`. */
  function add(product: CartProduct, quantity = 1): string | null {
    const result = addToCart(items.value, product, quantity)
    items.value = result.items
    persist()
    return result.message
  }

  function setQuantity(productId: number, quantity: number): string | null {
    const result = updateCartQuantity(items.value, productId, quantity)
    items.value = result.items
    persist()
    return result.message
  }

  function remove(productId: number): void {
    items.value = removeFromCart(items.value, productId)
    persist()
  }

  function setPromoCode(code: string): void {
    promoCode.value = normalizePromoCode(code)
    persist()
  }

  function clear(): void {
    items.value = []
    promoCode.value = ''
    persist()
  }

  return {
    items,
    promoCode,
    itemCount,
    isEmpty,
    summary,
    add,
    setQuantity,
    remove,
    setPromoCode,
    clear,
  }
})
