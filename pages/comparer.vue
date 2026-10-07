<script setup lang="ts">
import type { Product } from '~/types/dummyjson'

// Une instance de page par URL : passer d'une comparaison à une autre refait le chargement
// et la normalisation (comme la fiche produit).
definePageMeta({ key: (route) => route.fullPath })

const route = useRoute()
const requestUrl = useRequestURL()
const api = useApi()

// L'URL est la seule source de vérité de la page : un lien partagé affiche les mêmes
// produits chez n'importe qui, dès le rendu serveur. Le cookie `compare` ne sert pas ici.
const requestedIds = computed((): number[] => parseCompareIds(route.query.ids))

// Appels en parallèle, un par produit (`getProductsByIds`, #45) : l'échec de l'un
// n'empêche pas l'affichage des autres. Le `signal` coupe les requêtes si l'URL change.
const { data, status, refresh } = await useAsyncData(
  'compare',
  (_nuxtApp, { signal }) => api.getProductsByIds(requestedIds.value, { signal }),
  { watch: [requestedIds] },
)

const products = computed((): Product[] => data.value?.products ?? [])
const failedIds = computed((): number[] => data.value?.failedIds ?? [])
const loading = computed((): boolean => status.value === 'pending')

// Normalisation : identifiants invalides, en double, au-delà de 3 ou inexistants (404) retirés.
// `replace` : l'URL corrigée remplace l'ancienne dans l'historique (pas d'entrée « cassée »).
// Côté serveur, c'est une redirection HTTP : jamais d'erreur 500.
const canonicalIds = computed((): number[] => {
  const missing = data.value?.missingIds ?? []
  return requestedIds.value.filter((id) => !missing.includes(id))
})
if (!isCanonicalCompareQuery(route.query.ids, canonicalIds.value)) {
  await navigateTo(
    { query: { ...route.query, ids: formatCompareIds(canonicalIds.value) ?? undefined } },
    { replace: true },
  )
}

// --- Copier le lien ------------------------------------------------------------------
const shareUrl = computed((): string => {
  const ids = formatCompareIds(canonicalIds.value)
  return `${requestUrl.origin}/comparer${ids ? `?ids=${ids}` : ''}`
})
const copyStatus = ref('')
const showFallback = ref(false)
const fallbackInput = ref<HTMLInputElement | null>(null)

async function copyLink(): Promise<void> {
  try {
    // Clipboard API : absente sans HTTPS ou sur de vieux navigateurs, refusée selon les droits.
    if (!navigator.clipboard) throw new Error('Clipboard API indisponible')
    await navigator.clipboard.writeText(shareUrl.value)
    showFallback.value = false
    copyStatus.value = 'Lien copié dans le presse-papiers.'
  } catch {
    // Repli : le lien est affiché, sélectionné, prêt à être copié au clavier.
    showFallback.value = true
    copyStatus.value =
      'Copie automatique impossible : le lien est sélectionné ci-dessous, copiez-le.'
    await nextTick()
    fallbackInput.value?.select()
  }
}

// --- SEO ----------------------------------------------------------------------------
const title = computed((): string =>
  products.value.length > 0
    ? `Comparer : ${products.value.map((product) => product.title).join(', ')}`
    : 'Comparer des produits',
)
useSeoMeta({
  title,
  description: 'Comparez jusqu’à 3 produits ChampaShop : prix, note, stock, garantie et livraison.',
  // Une page par combinaison possible : on ne la propose pas aux moteurs de recherche.
  robots: 'noindex, follow',
})
</script>

<template>
  <section class="compare" aria-labelledby="compare-title">
    <h1 id="compare-title">Comparer des produits</h1>

    <!-- Toujours présent : une zone de statut n'est annoncée que si elle existait déjà. -->
    <p class="compare__status" role="status">{{ copyStatus }}</p>

    <div v-if="canonicalIds.length === 0" class="compare__empty">
      <p>Aucun produit à comparer.</p>
      <NuxtLink to="/produits">Parcourir le catalogue</NuxtLink>
    </div>

    <template v-else>
      <div class="compare__actions">
        <button type="button" class="compare__button" @click="copyLink">Copier le lien</button>
      </div>
      <div v-if="showFallback" class="compare__fallback">
        <label for="compare-share-url">Lien de cette comparaison</label>
        <input
          id="compare-share-url"
          ref="fallbackInput"
          type="text"
          readonly
          :value="shareUrl"
          @focus="fallbackInput?.select()"
        />
      </div>

      <div v-if="failedIds.length > 0" class="compare__error" role="alert">
        <p>
          {{
            failedIds.length > 1
              ? `${failedIds.length} produits n'ont pas pu être chargés.`
              : 'Un produit n’a pas pu être chargé.'
          }}
        </p>
        <button type="button" class="compare__button" :disabled="loading" @click="refresh()">
          Réessayer
        </button>
      </div>

      <!-- Affichage provisoire : le tableau comparatif accessible arrive avec #48. -->
      <ul class="compare__list" :aria-busy="loading">
        <li v-for="product in products" :key="product.id" class="compare__item">
          <img :src="product.thumbnail" alt="" width="120" height="120" loading="lazy" />
          <NuxtLink :to="`/produits/${product.id}`">{{ product.title }}</NuxtLink>
          <span>{{ formatCents(toCents(product.price)) }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.compare__status:empty {
  margin: 0;
}
.compare__empty,
.compare__error {
  padding: 1.5rem;
  border: 1px dashed #9ca3af;
  border-radius: 0.5rem;
}
.compare__error {
  border-color: #b91c1c;
}
.compare__actions {
  margin-bottom: 1rem;
}
.compare__button {
  padding: 0.5rem 1rem;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: #1f2937;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}
.compare__button:focus-visible,
.compare__fallback input:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
.compare__fallback {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 40rem;
  margin-bottom: 1rem;
}
.compare__fallback input {
  padding: 0.5rem 0.75rem;
  font: inherit;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
}
.compare__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.compare__item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
