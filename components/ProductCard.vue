<script setup lang="ts">
import type { Product } from '~/types/dummyjson'

// Seuls les champs affichés : la carte peut recevoir un produit partiel (ségrégation des interfaces).
// `headingLevel` : 2 dans le catalogue (sous le h1), 3 quand la carte est dans une section
// qui a son propre h2 (ex. « Produits vus récemment »), pour garder une hiérarchie de titres juste.
const props = withDefaults(
  defineProps<{
    product: Pick<Product, 'id' | 'title' | 'price' | 'rating' | 'discountPercentage' | 'thumbnail'>
    headingLevel?: 2 | 3
  }>(),
  { headingLevel: 2 },
)

const badge = computed((): string | null => discountBadge(props.product.discountPercentage))
const price = computed((): string => formatCents(toCents(props.product.price)))
const rating = computed((): string => formatRating(props.product.rating))
</script>

<template>
  <article class="card">
    <!-- alt vide : le titre juste en dessous décrit déjà le produit, un lecteur d'écran le lirait deux fois. -->
    <img
      class="card__image"
      :src="product.thumbnail"
      alt=""
      width="300"
      height="300"
      loading="lazy"
      decoding="async"
    />
    <p v-if="badge" class="card__badge">
      <span class="visually-hidden">Remise de</span>
      {{ badge }}
    </p>
    <component :is="`h${headingLevel}`" class="card__title">
      <!-- Le lien couvre toute la carte (::after) mais son nom accessible reste le titre. -->
      <NuxtLink :to="`/produits/${product.id}`" class="card__link">{{ product.title }}</NuxtLink>
    </component>
    <p class="card__price">{{ price }}</p>
    <p class="card__rating">
      <span aria-hidden="true">★</span>
      <span class="visually-hidden">Note :</span>
      {{ rating }}<span class="visually-hidden"> sur 5</span>
    </p>
    <CompareButton
      :product="{ id: product.id, title: product.title, thumbnail: product.thumbnail }"
    />
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  height: 100%;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow 200ms ease-out,
    transform 200ms ease-out;
}
.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.card:focus-within {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
.card__image {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: contain;
  background: var(--color-surface-muted);
  border-radius: var(--radius-md);
}
.card__badge {
  position: absolute;
  top: var(--space-4);
  left: var(--space-4);
  margin: 0;
  padding: 0.125rem var(--space-2);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-on-primary);
  background: var(--color-danger);
  border-radius: var(--radius-pill);
}
.card__title {
  margin: var(--space-2) 0 0;
  font-size: var(--text-base);
  line-height: 1.3;
}
.card__link {
  color: inherit;
  text-decoration: none;
}
.card:hover .card__link {
  color: var(--color-primary);
  text-decoration: underline;
}
.card__link::after {
  content: '';
  position: absolute;
  inset: 0;
}
.card__link:focus-visible {
  outline: none;
}
.card__price {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-heading);
}
.card__rating {
  margin: 0 0 var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
/* L'étoile est décorative ; sa teinte chaude ne porte aucune information (la note est écrite). */
.card__rating [aria-hidden='true'] {
  color: var(--color-warning-border);
}
/* Le bouton « Comparer » reste en bas : tous les boutons d'une rangée sont alignés. */
.card :deep(.compare-button) {
  margin-top: auto;
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
