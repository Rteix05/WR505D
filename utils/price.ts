const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
})

/** Convertit un prix DummyJSON (euros, décimal) en centimes entiers. */
export function toCents(price: number): number {
  return Math.round(price * 100)
}

/** Formate un montant en centimes, ex. 1099 → « 10,99 € ». */
export function formatCents(cents: number): string {
  return euroFormatter.format(cents / 100)
}

/**
 * Pourcentage d'un montant en centimes, arrondi commercial (demi vers le haut).
 * Calcul en entiers pour éviter les erreurs de virgule flottante.
 */
export function percentOfCents(amountCents: number, percent: number): number {
  return Math.floor((amountCents * percent + 50) / 100)
}
