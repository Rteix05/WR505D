import type { AppliedDiscount, CartSummary } from '../types/promotions'
import type { CartItem } from '../types/cart'
import { formatCents, percentOfCents } from './price'
import {
  BEAUTY_CATEGORY,
  BEAUTY_MIN_ITEMS,
  BEAUTY_PERCENT,
  DISCOUNT_CAP_PERCENT,
  FREE_SHIPPING_MIN_CENTS,
  NO_FREE_SHIPPING_CATEGORY,
  PROMO_AMOUNT_CENTS,
  PROMO_MIN_SUBTOTAL_CENTS,
} from './promotions'

// Fonctions d'affichage de la page panier. Elles expliquent le résultat de computeCart
// sans refaire le calcul : le montant de chaque remise vient toujours du récapitulatif.

/** Phrase qui explique pourquoi une remise s'applique (et pourquoi elle est réduite). */
export function discountReason(discount: AppliedDiscount): string {
  if (discount.id === 'BEAUTY_3') {
    return `-${BEAUTY_PERCENT} % sur chaque article beauté, dès ${BEAUTY_MIN_ITEMS} articles beauté dans le panier.`
  }
  if (discount.amountCents < PROMO_AMOUNT_CENTS) {
    return `Code réduit à ${formatCents(discount.amountCents)} : le total des remises est limité à ${DISCOUNT_CAP_PERCENT} % du montant brut.`
  }
  return `${formatCents(PROMO_AMOUNT_CENTS)} de réduction pour un sous-total supérieur à ${formatCents(PROMO_MIN_SUBTOTAL_CENTS)} après remise beauté.`
}

/**
 * Part de la remise beauté qui revient à une ligne. computeCart arrondit ligne par ligne,
 * donc la somme de ces parts est exactement le montant de la remise (un test le vérifie).
 */
export function lineBeautyDiscountCents(item: CartItem, summary: CartSummary): number {
  const beautyApplies = summary.discounts.some((discount) => discount.id === 'BEAUTY_3')
  if (!beautyApplies || item.category !== BEAUTY_CATEGORY) return 0
  return percentOfCents(item.unitPriceCents * item.quantity, BEAUTY_PERCENT)
}

/** Montant manquant pour la livraison offerte, ou `null` si elle l'est déjà ou ne peut pas l'être. */
export function freeShippingRemainingCents(items: CartItem[], summary: CartSummary): number | null {
  if (items.length === 0 || summary.shippingCents === 0) return null
  if (items.some((item) => item.category === NO_FREE_SHIPPING_CATEGORY)) return null
  const afterDiscountsCents = summary.totalCents - summary.shippingCents
  return FREE_SHIPPING_MIN_CENTS - afterDiscountsCents
}
