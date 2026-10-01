// Panier (F3). Montants en centimes, comme dans types/promotions.ts.

/** Une ligne du panier : ce que `computeCart` attend, plus le stock pour la limite. */
export interface CartItem {
  productId: number
  quantity: number
  unitPriceCents: number
  category: string
  stock: number
}

/** Le strict nécessaire d'un produit DummyJSON pour l'ajouter au panier (prix en euros). */
export interface CartProduct {
  id: number
  price: number
  category: string
  stock: number
}

/**
 * Ligne telle qu'elle est stockée dans le cookie : un tuple plutôt qu'un objet,
 * car `useCookie` encode le JSON en URL (chaque `"` devient `%22`) et le cookie
 * doit rester sous 4 Ko.
 */
export type CartCookieLine = [
  productId: number,
  quantity: number,
  unitPriceCents: number,
  category: string,
  stock: number,
]

export interface CartCookie {
  items: CartCookieLine[]
  promoCode: string
}

/** Résultat d'une action sur le panier : les nouvelles lignes et, si besoin, une explication. */
export interface CartUpdate {
  items: CartItem[]
  message: string | null
}

export interface CartState {
  items: CartItem[]
  promoCode: string
}

/** Produit rechargé par la page panier : de quoi afficher la ligne et resynchroniser prix et stock. */
export interface CartProductDetails extends CartProduct {
  title: string
  thumbnail: string
}

/** Résultat de la resynchronisation avec l'API : une explication par ligne modifiée. */
export interface CartSyncResult {
  items: CartItem[]
  messages: string[]
}
