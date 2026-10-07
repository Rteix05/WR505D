<script setup lang="ts">
import type { Product } from '~/types/dummyjson'

// Seuls les champs affichés : la carte peut recevoir un produit partiel (ségrégation des interfaces).
const props = defineProps<{
  product: Pick<Product, 'id' | 'title' | 'price' | 'rating' | 'discountPercentage' | 'thumbnail'>
}>()

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
    <h2 class="card__title">
      <!-- Le lien couvre toute la carte (::after) mais son nom accessible reste le titre. -->
      <NuxtLink :to="`/produits/${product.id}`" class="card__link">{{ product.title }}</NuxtLink>
    </h2>
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
  gap: 0.25rem;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  background: #fff;
}
.card:focus-within {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
.card__image {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: contain;
  background: #f3f4f6;
  border-radius: 0.375rem;
}
.card__badge {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  margin: 0;
  padding: 0.125rem 0.5rem;
  font-weight: 700;
  font-size: 0.875rem;
  color: #fff;
  background: #b91c1c;
  border-radius: 999px;
}
.card__title {
  margin: 0.5rem 0 0;
  font-size: 1rem;
}
.card__link {
  color: inherit;
  text-decoration: none;
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
  font-weight: 700;
}
.card__rating {
  margin: 0;
  color: #4b5563;
  font-size: 0.875rem;
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
