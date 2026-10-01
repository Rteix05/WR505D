<script setup lang="ts">
useSeoMeta({
  title: 'Panier',
  description: 'Votre panier ChampaShop : articles, code promo, remises et total.',
  robots: 'noindex, nofollow',
})

const cart = useCartStore()
const { productFor, syncMessages } = await useCartProducts()

const statusMessage = ref('')
const titleRef = ref<HTMLHeadingElement | null>(null)

const promoAccepted = computed((): boolean =>
  cart.summary.discounts.some((discount) => discount.id === 'TROYES10'),
)
const shippingRemaining = computed((): number | null =>
  freeShippingRemainingCents(cart.items, cart.summary),
)

function titleOf(productId: number): string {
  return productFor(productId)?.title ?? `Produit n° ${productId}`
}

function onQuantity(productId: number, quantity: number): void {
  statusMessage.value = cart.setQuantity(productId, quantity) ?? ''
}

function onRemove(productId: number): void {
  const title = titleOf(productId)
  cart.remove(productId)
  statusMessage.value = `« ${title} » a été retiré du panier.`
  // Le bouton cliqué vient de disparaître : on replace le focus sur le titre
  // pour que la navigation au clavier reparte d'un endroit connu.
  titleRef.value?.focus()
}
</script>

<template>
  <section class="cart" aria-labelledby="cart-title">
    <h1 id="cart-title" ref="titleRef" tabindex="-1">Mon panier</h1>

    <p role="status" class="cart__status">{{ statusMessage }}</p>

    <ul v-if="syncMessages.length" class="cart__notices">
      <li v-for="message in syncMessages" :key="message">{{ message }}</li>
    </ul>

    <div v-if="cart.isEmpty" class="cart__empty">
      <p>Votre panier est vide.</p>
      <NuxtLink to="/">Continuer mes achats</NuxtLink>
    </div>

    <div v-else class="cart__layout">
      <ul class="cart__lines" aria-label="Articles du panier">
        <CartItemRow
          v-for="item in cart.items"
          :key="item.productId"
          :item="item"
          :title="titleOf(item.productId)"
          :thumbnail="productFor(item.productId)?.thumbnail"
          :discount-cents="lineBeautyDiscountCents(item, cart.summary)"
          @update-quantity="onQuantity(item.productId, $event)"
          @remove="onRemove(item.productId)"
        />
      </ul>

      <div class="cart__side">
        <CartPromoForm
          :code="cart.promoCode"
          :accepted="promoAccepted"
          :messages="cart.summary.messages"
          @apply="cart.setPromoCode"
          @clear="cart.setPromoCode('')"
        />
        <CartSummaryPanel
          :summary="cart.summary"
          :free-shipping-remaining-cents="shippingRemaining"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.cart h1:focus {
  outline: none;
}
.cart h1:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
.cart__status:empty {
  margin: 0;
}
.cart__notices {
  padding: 0.75rem 1rem 0.75rem 2rem;
  background: #fffbeb;
  border: 1px solid #d97706;
  border-radius: 0.375rem;
}
.cart__layout {
  display: grid;
  gap: 2rem;
}
@media (min-width: 768px) {
  .cart__layout {
    grid-template-columns: 1fr 20rem;
    align-items: start;
  }
}
.cart__lines {
  margin: 0;
  padding: 0;
  list-style: none;
}
.cart__side {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>
