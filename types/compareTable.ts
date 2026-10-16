import type { Product } from './dummyjson'

/** Champs d'un produit affichés dans le tableau comparatif (#48). */
export type CompareTableProduct = Pick<
  Product,
  | 'id'
  | 'title'
  | 'thumbnail'
  | 'price'
  | 'discountPercentage'
  | 'rating'
  | 'availabilityStatus'
  | 'stock'
  | 'brand'
  | 'category'
  | 'weight'
  | 'dimensions'
  | 'warrantyInformation'
  | 'shippingInformation'
>

/** Une ligne du tableau : une caractéristique, une cellule par produit (même ordre). */
export interface CompareRow {
  id: string
  /** Libellé de la caractéristique, en en-tête de ligne (`<th scope="row">`). */
  label: string
  /** Texte de chaque cellule, dans l'ordre des produits. */
  cells: string[]
  /** Index des produits qui ont la meilleure valeur (vide si la ligne n'est pas comparable ou si tous sont à égalité). */
  best: number[]
  /** Libellé texte de la meilleure valeur, ex. « Meilleur prix » (pas seulement une couleur). */
  bestLabel: string | null
  /** Toutes les cellules sont identiques : ligne masquée par « Afficher uniquement les différences ». */
  same: boolean
}
