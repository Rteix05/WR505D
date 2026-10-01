/** Niveau de stock affiché sur la fiche produit. */
export type StockLevel = 'in' | 'low' | 'out'

export interface ProductStock {
  level: StockLevel
  /** Texte affiché, ex. « Plus que 3 en stock ». */
  label: string
}
