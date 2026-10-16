/**
 * Ce que la barre du comparateur affiche d'un produit. Gardé en mémoire (jamais dans le cookie,
 * qui ne contient que les identifiants) : titre et miniature viennent de la carte ou de la fiche
 * au moment du clic, ou d'un appel `select=title,thumbnail` après un rechargement.
 */
export interface CompareSummary {
  id: number
  title: string
  thumbnail: string
}
