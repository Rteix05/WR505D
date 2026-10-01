// Contrat imposé par le sujet (F4). Tous les montants sont en centimes (entiers).

export interface CartLine {
  productId: number
  category: string
  unitPriceCents: number
  quantity: number
}

export type DiscountId = 'BEAUTY_3' | 'TROYES10'

export interface AppliedDiscount {
  id: DiscountId
  label: string
  /** Montant de la remise, positif (ex. 300 pour -3,00 €). */
  amountCents: number
}

export interface CartSummary {
  grossCents: number
  discounts: AppliedDiscount[]
  shippingCents: number
  totalCents: number
  /** Explications pour l'utilisateur, ex. : pourquoi un code est refusé. */
  messages: string[]
}
