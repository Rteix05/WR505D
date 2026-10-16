<script setup lang="ts">
import type { CartSummary } from '~/types/promotions'

defineProps<{
  summary: CartSummary
  /** Montant manquant pour la livraison offerte, `null` si sans objet. */
  freeShippingRemainingCents: number | null
}>()
</script>

<template>
  <section class="summary" aria-labelledby="summary-title">
    <h2 id="summary-title" class="summary__title">Récapitulatif</h2>
    <dl class="summary__list">
      <div class="summary__row">
        <dt>Montant brut</dt>
        <dd>{{ formatCents(summary.grossCents) }}</dd>
      </div>

      <div v-for="discount in summary.discounts" :key="discount.id" class="summary__row">
        <dt>
          {{ discount.label }}
          <span class="summary__reason">{{ discountReason(discount) }}</span>
        </dt>
        <dd class="summary__discount">-{{ formatCents(discount.amountCents) }}</dd>
      </div>

      <div class="summary__row">
        <dt>
          Livraison
          <span v-if="freeShippingRemainingCents !== null" class="summary__reason">
            Plus que {{ formatCents(freeShippingRemainingCents) }} pour la livraison offerte.
          </span>
        </dt>
        <dd>{{ summary.shippingCents === 0 ? 'Offerte' : formatCents(summary.shippingCents) }}</dd>
      </div>

      <div class="summary__row summary__row--total">
        <dt>Total</dt>
        <dd>{{ formatCents(summary.totalCents) }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.summary {
  padding: 1rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
}
.summary__title {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
}
.summary__list {
  margin: 0;
}
.summary__row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
}
.summary__row dd {
  margin: 0;
  white-space: nowrap;
}
.summary__reason {
  display: block;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}
.summary__discount {
  color: var(--color-success);
}
.summary__row--total {
  margin-top: 0.25rem;
  border-top: 1px solid var(--color-border);
  font-size: 1.125rem;
  font-weight: 700;
}
</style>
