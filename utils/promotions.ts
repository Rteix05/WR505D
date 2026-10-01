import type { AppliedDiscount, CartLine, CartSummary } from '../types/promotions'
import { formatCents, percentOfCents } from './price'

export type { AppliedDiscount, CartLine, CartSummary } from '../types/promotions'

export const BEAUTY_CATEGORY = 'beauty'
export const BEAUTY_MIN_ITEMS = 3
export const BEAUTY_PERCENT = 10

export const PROMO_CODE = 'TROYES10'
export const PROMO_AMOUNT_CENTS = 1000
export const PROMO_MIN_SUBTOTAL_CENTS = 5000

export const DISCOUNT_CAP_PERCENT = 25

export const SHIPPING_CENTS = 490
export const FREE_SHIPPING_MIN_CENTS = 8000
export const NO_FREE_SHIPPING_CATEGORY = 'furniture'

/** Une ligne est prise en compte si quantité et prix sont des entiers valides. */
function isValidLine(line: CartLine): boolean {
  return (
    Number.isInteger(line.quantity) &&
    line.quantity > 0 &&
    Number.isInteger(line.unitPriceCents) &&
    line.unitPriceCents >= 0
  )
}

function lineTotalCents(line: CartLine): number {
  return line.unitPriceCents * line.quantity
}

function sumDiscounts(discounts: AppliedDiscount[]): number {
  return discounts.reduce((sum, discount) => sum + discount.amountCents, 0)
}

/** Règle 1 : -10 % sur chaque ligne beauty dès 3 articles beauty, arrondi ligne par ligne. */
export function beautyDiscount(lines: CartLine[]): AppliedDiscount | null {
  const beautyLines = lines.filter((line) => line.category === BEAUTY_CATEGORY)
  const beautyItems = beautyLines.reduce((sum, line) => sum + line.quantity, 0)
  if (beautyItems < BEAUTY_MIN_ITEMS) return null

  const amountCents = beautyLines.reduce(
    (sum, line) => sum + percentOfCents(lineTotalCents(line), BEAUTY_PERCENT),
    0,
  )
  return {
    id: 'BEAUTY_3',
    label: `Remise beauté : -${BEAUTY_PERCENT} % dès ${BEAUTY_MIN_ITEMS} articles beauté`,
    amountCents,
  }
}

type PromoResult = { discount: AppliedDiscount | null; message: string | null }

/** Règle 2 : code TROYES10, -10,00 € si le sous-total après remise beauté dépasse 50,00 €. */
export function promoCodeDiscount(
  promoCode: string | undefined,
  subtotalCents: number,
): PromoResult {
  const code = promoCode?.trim().toUpperCase() ?? ''
  if (code === '') return { discount: null, message: null }

  if (code !== PROMO_CODE) {
    return { discount: null, message: `Le code « ${code} » n'existe pas.` }
  }
  if (subtotalCents <= PROMO_MIN_SUBTOTAL_CENTS) {
    return {
      discount: null,
      message: `Le code ${PROMO_CODE} est refusé : il faut un sous-total supérieur à ${formatCents(PROMO_MIN_SUBTOTAL_CENTS)} après remises (actuellement ${formatCents(subtotalCents)}).`,
    }
  }
  return {
    discount: { id: 'TROYES10', label: `Code ${PROMO_CODE}`, amountCents: PROMO_AMOUNT_CENTS },
    message: null,
  }
}

/**
 * Règle 3 : le total des remises ne dépasse jamais 25 % du brut.
 * En cas de dépassement, c'est le code promo qui est réduit, et lui seul (règle du sujet).
 * Sans code promo, rien n'est réduit : aujourd'hui la remise beauté (10 %) ne peut pas
 * dépasser seule le plafond, et le message ne parle que de ce qui a vraiment changé.
 */
export function applyDiscountCap(
  discounts: AppliedDiscount[],
  grossCents: number,
): { discounts: AppliedDiscount[]; message: string | null } {
  const capCents = percentOfCents(grossCents, DISCOUNT_CAP_PERCENT)
  const excessCents = sumDiscounts(discounts) - capCents
  const promo = discounts.find((discount) => discount.id === 'TROYES10')
  if (excessCents <= 0 || !promo) return { discounts, message: null }

  const reducedCents = Math.max(0, promo.amountCents - excessCents)
  const capped = discounts
    .map((discount) => (discount === promo ? { ...discount, amountCents: reducedCents } : discount))
    .filter((discount) => discount.amountCents > 0)

  const reason = `les remises ne peuvent pas dépasser ${DISCOUNT_CAP_PERCENT} % du montant brut`
  return {
    discounts: capped,
    message:
      reducedCents > 0
        ? `Le code ${PROMO_CODE} est limité à ${formatCents(reducedCents)} : ${reason}.`
        : `Le code ${PROMO_CODE} ne s'applique pas : ${reason}.`,
  }
}

/** Règle 4 : livraison 4,90 €, offerte dès 80,00 € après remises, sauf produit furniture. */
export function computeShipping(lines: CartLine[], afterDiscountsCents: number): number {
  if (lines.length === 0) return 0
  const hasFurniture = lines.some((line) => line.category === NO_FREE_SHIPPING_CATEGORY)
  if (!hasFurniture && afterDiscountsCents >= FREE_SHIPPING_MIN_CENTS) return 0
  return SHIPPING_CENTS
}

/** Calcule le récapitulatif du panier. Fonction pure : aucune dépendance à Vue ou Pinia. */
export function computeCart(lines: CartLine[], promoCode?: string): CartSummary {
  const validLines = lines.filter(isValidLine)
  const grossCents = validLines.reduce((sum, line) => sum + lineTotalCents(line), 0)
  const messages: string[] = []
  let discounts: AppliedDiscount[] = []

  const beauty = beautyDiscount(validLines)
  if (beauty) discounts.push(beauty)

  const promo = promoCodeDiscount(promoCode, grossCents - sumDiscounts(discounts))
  if (promo.discount) discounts.push(promo.discount)
  if (promo.message) messages.push(promo.message)

  const cap = applyDiscountCap(discounts, grossCents)
  discounts = cap.discounts
  if (cap.message) messages.push(cap.message)

  const afterDiscountsCents = grossCents - sumDiscounts(discounts)
  const shipping = computeShipping(validLines, afterDiscountsCents)

  return {
    grossCents,
    discounts,
    shippingCents: shipping,
    totalCents: afterDiscountsCents + shipping,
    messages,
  }
}
