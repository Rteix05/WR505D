<script setup lang="ts">
import type { CompareSummary } from '~/types/compare'

// Seuls les champs nécessaires : la carte comme la fiche produit peuvent le fournir.
const props = defineProps<{ product: CompareSummary }>()

const compare = useCompareStore()
const selected = computed((): boolean => compare.has(props.product.id))
const name = computed((): string => compareButtonName(props.product.title))
</script>

<template>
  <!-- Bouton bascule : le libellé ne change jamais, c'est `aria-pressed` qui porte l'état.
       Jamais désactivé : au comparateur plein, le clic est refusé et expliqué (aria-live). -->
  <button
    type="button"
    class="compare-button"
    :aria-pressed="selected"
    :aria-label="name"
    @click="compare.toggle(product)"
  >
    <svg
      v-if="selected"
      class="compare-button__icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 8.5l3.2 3L13 4.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    Comparer
  </button>
</template>

<style scoped>
.compare-button {
  /* Au-dessus du lien qui couvre toute la carte (::after de ProductCard). */
  position: relative;
  z-index: 1;
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  min-height: 2.75rem;
  padding: 0.5rem 0.875rem;
  font: inherit;
  font-weight: 600;
  color: #1f2937;
  background: #fff;
  border: 2px solid #1f2937;
  border-radius: 0.375rem;
  cursor: pointer;
  transition:
    background-color 150ms ease-out,
    color 150ms ease-out;
}
.compare-button:hover {
  background: #f3f4f6;
}
.compare-button[aria-pressed='true'] {
  color: #fff;
  background: #1f2937;
}
.compare-button:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .compare-button {
    transition: none;
  }
}
</style>
