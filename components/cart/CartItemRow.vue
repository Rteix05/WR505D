<script setup lang="ts">
import type { CartItem } from '~/types/cart'

const props = defineProps<{
  item: CartItem
  title: string
  thumbnail?: string
  /** Part de la remise beauté sur cette ligne (0 si aucune). */
  discountCents: number
}>()

const emit = defineEmits<{
  'update-quantity': [quantity: number]
  remove: []
}>()

const inputId = computed((): string => `quantity-${props.item.productId}`)
const lineTotalCents = computed((): number => props.item.unitPriceCents * props.item.quantity)

function onQuantityChange(event: Event): void {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  emit('update-quantity', Number(input.value))
  // Si la valeur est refusée (vide, 0, décimale), le store ne change pas : on réaffiche
  // la vraie quantité, sinon le champ garderait une valeur qui ne correspond à rien.
  nextTick(() => {
    input.value = String(props.item.quantity)
  })
}
</script>

<template>
  <li class="row">
    <img
      v-if="thumbnail"
      :src="thumbnail"
      alt=""
      width="80"
      height="80"
      loading="lazy"
      class="row__image"
    />
    <div class="row__info">
      <h2 class="row__title">{{ title }}</h2>
      <p class="row__unit">{{ formatCents(item.unitPriceCents) }} l'unité</p>
      <p v-if="discountCents > 0" class="row__discount">
        Remise beauté : -{{ formatCents(discountCents) }}
      </p>
    </div>

    <div class="row__quantity">
      <!-- Boutons jamais désactivés : un bouton désactivé perd le focus clavier.
           Au-delà du stock ou sous 1, le store refuse et la page explique pourquoi. -->
      <button
        type="button"
        class="row__step"
        :aria-label="`Retirer un exemplaire de ${title}`"
        @click="emit('update-quantity', item.quantity - 1)"
      >
        −
      </button>
      <label :for="inputId" class="visually-hidden">Quantité de {{ title }}</label>
      <input
        :id="inputId"
        class="row__input"
        type="number"
        inputmode="numeric"
        min="1"
        :max="item.stock"
        :value="item.quantity"
        @change="onQuantityChange"
      />
      <button
        type="button"
        class="row__step"
        :aria-label="`Ajouter un exemplaire de ${title}`"
        @click="emit('update-quantity', item.quantity + 1)"
      >
        +
      </button>
    </div>

    <p class="row__total">{{ formatCents(lineTotalCents) }}</p>

    <button type="button" class="row__remove" @click="emit('remove')">
      Retirer<span class="visually-hidden"> {{ title }} du panier</span>
    </button>
  </li>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: 0.5rem 1rem;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}
.row__image {
  grid-row: span 2;
  object-fit: cover;
  border-radius: 0.375rem;
  background: #f3f4f6;
}
.row__title {
  margin: 0;
  font-size: 1rem;
}
.row__unit,
.row__discount {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: #4b5563;
}
.row__discount {
  color: #166534;
}
.row__quantity {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.row__step {
  width: 2.25rem;
  height: 2.25rem;
  font: inherit;
  font-size: 1.125rem;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
  background: #fff;
  cursor: pointer;
}
.row__input {
  width: 3.5rem;
  height: 2.25rem;
  font: inherit;
  text-align: center;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
}
.row__total {
  margin: 0;
  font-weight: 600;
  text-align: right;
}
.row__remove {
  justify-self: end;
  padding: 0.25rem 0.5rem;
  font: inherit;
  font-size: 0.875rem;
  color: #b91c1c;
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
}
button:focus-visible,
input:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
