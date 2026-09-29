<script setup lang="ts">
import type { ProductsResponse } from '~/types/dummyjson'

/** Imposé par le sujet : 12 produits par page. */
const PAGE_SIZE = 12

const route = useRoute()
const config = useRuntimeConfig()
const api = useApi()

// L'URL est la source de vérité : un lien partagé ou un retour arrière réaffiche la même page.
const page = computed((): number => pageFromQuery(route.query.page))

// Exécuté côté serveur au premier affichage (le HTML contient déjà les produits,
// même sans JavaScript), puis côté client à chaque changement de `?page=`.
const { data, status, error, refresh } = await useAsyncData<ProductsResponse>(
  'catalogue',
  () => api.getProducts({ limit: PAGE_SIZE, skip: (page.value - 1) * PAGE_SIZE }),
  { watch: [page] },
)

const products = computed(() => data.value?.products ?? [])
const total = computed((): number => data.value?.total ?? 0)
const totalPages = computed((): number => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const loading = computed((): boolean => status.value === 'pending')
/** `?page=99` : l'API répond sans erreur mais sans produits, alors qu'il en existe. */
const outOfRange = computed((): boolean => products.value.length === 0 && total.value > 0)

const statusMessage = computed((): string => {
  if (loading.value) return 'Chargement des produits…'
  if (error.value || products.value.length === 0) return ''
  return `${total.value} produits, page ${page.value} sur ${totalPages.value}`
})

// Après un changement de page, le focus revient sur le titre (et la vue remonte) :
// sinon un utilisateur clavier resterait en bas, sur un lien qui a changé de sens.
const heading = ref<HTMLHeadingElement | null>(null)
watch(page, async () => {
  await nextTick()
  heading.value?.focus()
})

const title = computed((): string => (page.value > 1 ? `Produits, page ${page.value}` : 'Produits'))
const canonical = computed(
  (): string => `${config.public.siteUrl}/produits${page.value > 1 ? `?page=${page.value}` : ''}`,
)

useSeoMeta({
  title,
  description: 'Tout le catalogue ChampaShop : beauté, high-tech, maison, mode et plus encore.',
  ogTitle: title,
  ogDescription: 'Tout le catalogue ChampaShop : beauté, high-tech, maison, mode et plus encore.',
  ogType: 'website',
  ogUrl: canonical,
})
useHead({ link: [{ rel: 'canonical', href: canonical }] })
</script>

<template>
  <section class="catalogue" aria-labelledby="catalogue-title">
    <h1 id="catalogue-title" ref="heading" tabindex="-1" class="catalogue__title">Produits</h1>

    <!-- Toujours présente : une zone de statut n'est annoncée que si elle existait déjà. -->
    <p class="catalogue__status" role="status">{{ statusMessage }}</p>

    <div v-if="error && !loading" class="catalogue__message" role="alert">
      <p>Impossible de charger les produits. Vérifiez votre connexion puis réessayez.</p>
      <button type="button" class="catalogue__button" @click="refresh()">Réessayer</button>
    </div>

    <div v-else-if="!loading && products.length === 0" class="catalogue__message">
      <p v-if="outOfRange">Cette page n'existe pas : le catalogue compte {{ totalPages }} pages.</p>
      <p v-else>Aucun produit à afficher pour le moment.</p>
      <NuxtLink v-if="outOfRange" to="/produits" class="catalogue__button" :aria-current="false">
        Revenir à la première page
      </NuxtLink>
    </div>

    <ul v-else class="catalogue__grid" :aria-busy="loading">
      <template v-if="loading">
        <li v-for="n in PAGE_SIZE" :key="n"><ProductCardSkeleton /></li>
      </template>
      <template v-else>
        <li v-for="product in products" :key="product.id"><ProductCard :product="product" /></li>
      </template>
    </ul>

    <CatalogPagination v-if="!error && !outOfRange" :current="page" :total-pages="totalPages" />
  </section>
</template>

<style scoped>
.catalogue__title:focus {
  outline: none;
}
.catalogue__status {
  color: #4b5563;
}
.catalogue__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.catalogue__message {
  padding: 2rem;
  text-align: center;
  border: 1px dashed #9ca3af;
  border-radius: 0.5rem;
}
.catalogue__button {
  display: inline-block;
  padding: 0.625rem 1rem;
  font: inherit;
  font-weight: 600;
  color: #fff;
  text-decoration: none;
  background: #1f2937;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}
.catalogue__button:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
</style>
