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
// Prix et stock relus auprès de l'API, comme sur /panier : un changement doit se voir AVANT de
// payer, pas après (suite à la review de #70).
const { productFor, syncMessages } = await useCartProducts()

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
        <ul
          v-if="syncMessages.length"
          class="checkout__notices"
          aria-label="Changements dans votre panier"
        >
          <li v-for="message in syncMessages" :key="message">{{ message }}</li>
        </ul>
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
            class="btn checkout__submit"
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
  gap: var(--space-6);
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
  margin: 0 0 var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  color: var(--color-danger);
}
.checkout__notices {
  margin: 0 0 var(--space-4);
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-6);
  color: var(--color-warning-text);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-md);
}
.checkout__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.checkout__fieldset {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.checkout__fieldset legend {
  padding: 0 var(--space-1);
  font-weight: 600;
  color: var(--color-heading);
}
.checkout__hint,
.checkout__notice {
  margin: 0;
  color: var(--color-text-muted);
}
.checkout__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.checkout__field input {
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-3);
  font: inherit;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
}
.checkout__field input[aria-invalid='true'] {
  border-color: var(--color-danger);
}
.checkout__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.875rem;
}
.checkout__submit:disabled {
  opacity: 0.7;
  cursor: wait;
}
.checkout__side {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.checkout__items {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.checkout__items h2 {
  margin: 0 0 var(--space-2);
  font-size: 1.125rem;
}
.checkout__items ul {
  margin: 0 0 var(--space-2);
  padding-left: var(--space-5);
}
</style>
