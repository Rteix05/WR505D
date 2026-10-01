/**
 * Texte du badge de remise, ex. 10.48 → « −10 % ». Arrondi à l'entier : une décimale
 * n'apporte rien sur un badge. Sous 1 %, pas de badge (« −0 % » n'a pas de sens).
 */
export function discountBadge(discountPercentage: number): string | null {
  const percent = Math.round(discountPercentage)
  return percent >= 1 ? `−${percent} %` : null
}

const ratingFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/** Note sur 5 à une décimale, format français : 4.56 → « 4,6 ». */
export function formatRating(rating: number): string {
  return ratingFormatter.format(rating)
}
