import type { Product } from './dummyjson'

/**
 * Ce qu'une carte « vu récemment » affiche : exactement les champs de `<ProductCard>`.
 * Gardé en mémoire (jamais dans le cookie, qui ne contient que les identifiants).
 */
export type RecentlyViewedSummary = Pick<
  Product,
  'id' | 'title' | 'price' | 'rating' | 'discountPercentage' | 'thumbnail'
>
