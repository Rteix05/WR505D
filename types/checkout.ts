// Formulaire de commande (#65) : champs, erreurs et corps de l'API panier.

/** Champs saisis lors du passage de commande, dans l'ordre d'affichage. */
export interface CheckoutForm {
  fullName: string
  email: string
  address: string
  postalCode: string
  city: string
}

export type CheckoutField = keyof CheckoutForm

/** Seuls les champs en erreur sont présents (Partial). */
export type CheckoutErrors = Partial<Record<CheckoutField, string>>

/** Corps de POST /carts/add (DummyJSON). */
export interface CartAddBody {
  userId: number
  products: { id: number; quantity: number }[]
}
