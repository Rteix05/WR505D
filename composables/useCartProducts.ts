import type { ComputedRef } from 'vue'
import type { CartProductDetails } from '~/types/cart'

export interface UseCartProducts {
  /** Titre et image d'une ligne ; `undefined` si le produit n'a pas pu être rechargé. */
  productFor: (productId: number) => CartProductDetails | undefined
  /** Changements constatés depuis l'ajout au panier (prix, stock). */
  syncMessages: ComputedRef<string[]>
}

const FIELDS = 'title,thumbnail,price,stock,category'

/**
 * Recharge les produits du panier depuis l'API, puis resynchronise prix et stock.
 * Le catalogue est public : on utilise $fetch, pas $authFetch (qui exige une session).
 */
export async function useCartProducts(): Promise<UseCartProducts> {
  const config = useRuntimeConfig()
  const cart = useCartStore()

  const { data } = await useAsyncData(
    'cart-products',
    async () => {
      const ids = cart.items.map((item) => item.productId)
      // allSettled : un produit supprimé ou une erreur réseau ne doit pas vider toute la page.
      const results = await Promise.allSettled(
        ids.map((id) =>
          $fetch<CartProductDetails>(`/products/${id}`, {
            baseURL: config.public.apiBase,
            query: { select: FIELDS },
          }),
        ),
      )
      const products = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      )
      // Fait ici (une seule fois, côté serveur au premier affichage) pour que le HTML
      // et le cookie renvoyés contiennent déjà le panier à jour.
      return { products, messages: cart.sync(products) }
    },
    { default: () => ({ products: [], messages: [] }) },
  )

  return {
    productFor: (productId) => data.value.products.find((product) => product.id === productId),
    syncMessages: computed(() => data.value.messages),
  }
}
