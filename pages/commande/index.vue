<script setup lang="ts">
import type { CheckoutField, CheckoutForm } from '~/types/checkout'
import type { CartAddResponse } from '~/types/dummyjson'
import { SessionExpiredError } from '~/utils/authFetch'

// DummyJSON exige un `userId` pour enregistrer un panier : la commande demande d'être connecté.
// Le middleware renvoie vers /connexion?redirect=/commande, puis ici après la connexion.
definePageMeta({ middleware: 'auth' })

useSeoMeta({
  title: 'Commande',
  description: 'Vos coordonnées de livraison et le paiement simulé de votre commande ChampaShop.',
  robots: 'noindex, nofollow',
})

const { $authFetch } = useNuxtApp()
const auth = useAuthStore()
const { user } = storeToRefs(auth)
const cart = useCartStore()
const { productFor } = await useCartProducts()

const LABELS: Record<CheckoutField, string> = {
  fullName: 'Nom et prénom',
  email: 'Adresse e-mail',
  address: 'Adresse',
  postalCode: 'Code postal',
  city: 'Ville',
}
// Valeurs `autocomplete` standard : le navigateur propose les coordonnées enregistrées (WCAG 1.3.5).
const AUTOCOMPLETE: Record<CheckoutField, string> = {
  fullName: 'name',
  email: 'email',
  address: 'street-address',
  postalCode: 'postal-code',
  city: 'address-level2',
}

// Pré-rempli avec le profil connecté : l'utilisateur n'a plus qu'à saisir son adresse.
const form = reactive<CheckoutForm>(prefillCheckout(user.value))
const errors = ref<Partial<Record<CheckoutField, string>>>({})
const formError = ref('')
const pending = ref(false)
const inputs = ref<Partial<Record<CheckoutField, HTMLInputElement>>>({})

const payLabel = computed(
  (): string => `Payer ${formatCents(cart.summary.totalCents)} (paiement simulé)`,
)

function setInput(field: CheckoutField, element: unknown): void {
  if (element instanceof HTMLInputElement) inputs.value[field] = element
}

function titleOf(productId: number): string {
  return productFor(productId)?.title ?? `Produit n° ${productId}`
}

async function onSubmit(): Promise<void> {
  formError.value = ''
  if (pending.value || !user.value) return

  Object.assign(form, normalizeCheckoutForm(form))
  errors.value = validateCheckout(form)
  const invalid = firstInvalidField(errors.value)
  if (invalid) {
    // Focus sur le premier champ en erreur : son message est lu avec lui (aria-describedby).
    inputs.value[invalid]?.focus()
    return
  }

  pending.value = true
  try {
    const order = await $authFetch<CartAddResponse>('/carts/add', {
      method: 'POST',
      body: { ...toCartAddBody(user.value.id, cart.items) },
    })
    await navigateTo({ path: '/commande/confirmation', query: { numero: String(order.id) } })
    // Vidé après la navigation : sinon la page afficherait « panier vide » le temps de partir.
    cart.clear()
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      await navigateTo(loginRedirectLocation('/commande'))
      return
    }
    // Le panier est gardé : l'utilisateur peut réessayer sans tout ressaisir.
    formError.value = orderErrorMessage(error)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="checkout" aria-labelledby="checkout-title">
    <h1 id="checkout-title">Commande</h1>

    <div v-if="cart.isEmpty" class="checkout__empty">
      <p>Votre panier est vide : il n'y a rien à commander.</p>
      <NuxtLink to="/produits">Voir les produits</NuxtLink>
    </div>

    <div v-else class="checkout__layout">
      <div>
        <!-- Toujours présente (même vide) : un lecteur d'écran n'annonce une zone role="alert" que si elle existait déjà. -->
        <p class="checkout__alert" :class="{ 'checkout__alert--visible': formError }" role="alert">
          {{ formError }}
        </p>

        <form class="checkout__form" novalidate @submit.prevent="onSubmit">
          <fieldset class="checkout__fieldset">
            <legend>Coordonnées de livraison</legend>
            <p class="checkout__hint">Tous les champs sont obligatoires.</p>

            <div v-for="field in CHECKOUT_FIELDS" :key="field" class="checkout__field">
              <label :for="`checkout-${field}`">{{ LABELS[field] }}</label>
              <input
                :id="`checkout-${field}`"
                :ref="(element) => setInput(field, element)"
                v-model="form[field]"
                :name="field"
                :type="field === 'email' ? 'email' : 'text'"
                :inputmode="field === 'postalCode' ? 'numeric' : undefined"
                :autocomplete="AUTOCOMPLETE[field]"
                required
                :aria-invalid="errors[field] ? 'true' : undefined"
                :aria-describedby="errors[field] ? `checkout-${field}-error` : undefined"
              />
              <p v-if="errors[field]" :id="`checkout-${field}-error`" class="checkout__error">
                {{ errors[field] }}
              </p>
            </div>
          </fieldset>

          <fieldset class="checkout__fieldset">
            <legend>Paiement</legend>
            <p id="payment-notice" class="checkout__notice">
              Paiement simulé : aucune donnée bancaire n'est demandée et rien n'est débité.
            </p>
          </fieldset>

          <button
            type="submit"
            class="checkout__submit"
            :disabled="pending"
            :aria-busy="pending"
            aria-describedby="payment-notice"
          >
            {{ pending ? 'Paiement en cours…' : payLabel }}
          </button>
        </form>
      </div>

      <div class="checkout__side">
        <section class="checkout__items" aria-labelledby="items-title">
          <h2 id="items-title">Votre commande</h2>
          <ul>
            <li v-for="item in cart.items" :key="item.productId">
              {{ titleOf(item.productId) }} × {{ item.quantity }}
            </li>
          </ul>
          <NuxtLink to="/panier">Modifier le panier</NuxtLink>
        </section>
        <CartSummaryPanel :summary="cart.summary" :free-shipping-remaining-cents="null" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.checkout__layout {
  display: grid;
  gap: 2rem;
}
@media (min-width: 768px) {
  .checkout__layout {
    grid-template-columns: 1fr 20rem;
    align-items: start;
  }
}
.checkout__alert {
  margin: 0;
}
.checkout__alert--visible {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid #b91c1c;
  border-radius: 0.375rem;
  color: #b91c1c;
}
.checkout__form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.checkout__fieldset {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}
.checkout__fieldset legend {
  padding: 0 0.25rem;
  font-weight: 600;
}
.checkout__hint,
.checkout__notice {
  margin: 0;
  color: #374151;
}
.checkout__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.checkout__field input {
  padding: 0.5rem 0.75rem;
  font: inherit;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
}
.checkout__field input[aria-invalid='true'] {
  border-color: #b91c1c;
}
.checkout__error {
  margin: 0;
  color: #b91c1c;
  font-size: 0.875rem;
}
.checkout__submit {
  padding: 0.75rem 1rem;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: #1f2937;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}
.checkout__submit:disabled {
  opacity: 0.7;
  cursor: wait;
}
.checkout__side {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.checkout__items h2 {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
}
.checkout__items ul {
  margin: 0 0 0.5rem;
  padding-left: 1.25rem;
}
:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
</style>
