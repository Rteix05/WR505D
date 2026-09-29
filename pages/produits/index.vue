<script setup lang="ts">
import type { CatalogFilters } from '~/types/catalog'
import type { ProductsResponse } from '~/types/dummyjson'

const route = useRoute()
const config = useRuntimeConfig()
const api = useApi()

// L'URL est la seule source de vérité : page, catégorie, tri (et plus tard recherche, prix)
// sont relus depuis la query à chaque changement, jamais copiés dans un ref.
const filters = computed((): CatalogFilters => parseCatalogQuery(route.query))

// Formulaire de filtres envoyé sans JavaScript (?category=…&sort=…) : on redirige vers
// l'URL canonique (sortBy + order, valeurs par défaut omises). Une vue = une URL.
if (SORT_FORM_PARAM in route.query) {
  await navigateTo({ path: '/produits', query: toCatalogQuery(filters.value) }, { replace: true })
}

const { data: categories } = await useAsyncData('categories', () => api.getCategories(), {
  default: () => [],
})

// Exécuté côté serveur au premier affichage (le HTML contient déjà les produits,
// même sans JavaScript), puis côté client à chaque changement de l'URL.
const { data, status, error, refresh } = await useAsyncData<ProductsResponse>(
  'catalogue',
  () => {
    const current = filters.value
    const params = { ...paginationParams(current.page), ...sortParams(current) }
    // DummyJSON a une route dédiée par catégorie ; le tri et la pagination s'y appliquent aussi.
    return current.category
      ? api.getProductsByCategory(current.category, params)
      : api.getProducts(params)
  },
  { watch: [filters] },
)

const page = computed((): number => filters.value.page)
const products = computed(() => data.value?.products ?? [])
const total = computed((): number => data.value?.total ?? 0)
const totalPages = computed((): number => pageCount(total.value))
const loading = computed((): boolean => status.value === 'pending')
/** `?page=99` : l'API répond sans erreur mais sans produits, alors qu'il en existe. */
const outOfRange = computed((): boolean => products.value.length === 0 && total.value > 0)
const currentCategory = computed(
  () => categories.value.find((item) => item.slug === filters.value.category) ?? null,
)

const statusMessage = computed((): string => {
  if (loading.value) return 'Chargement des produits…'
  if (error.value || products.value.length === 0) return ''
  const count = `${total.value} produit${total.value > 1 ? 's' : ''}`
  const where = currentCategory.value ? ` dans ${currentCategory.value.name}` : ''
  return `${count}${where}, page ${page.value} sur ${totalPages.value}`
})

async function applyFilters(changes: Partial<CatalogFilters>): Promise<void> {
  // updateFilters revient à la page 1 : la page 5 de l'ancien filtre n'a plus de sens.
  await navigateTo({ query: toCatalogQuery(updateFilters(filters.value, changes)) })
}

// Après un changement de page, le focus revient sur le titre (et la vue remonte) :
// sinon un utilisateur clavier resterait en bas, sur un lien qui a changé de sens.
const heading = ref<HTMLHeadingElement | null>(null)
watch(page, async () => {
  await nextTick()
  heading.value?.focus()
})

const title = computed((): string => {
  const name = currentCategory.value ? `Produits : ${currentCategory.value.name}` : 'Produits'
  return page.value > 1 ? `${name}, page ${page.value}` : name
})
const canonical = computed((): string => {
  const query = new URLSearchParams(Object.entries(toCatalogQuery(filters.value))).toString()
  return `${config.public.siteUrl}/produits${query ? `?${query}` : ''}`
})

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

    <CatalogToolbar :filters="filters" :categories="categories" @apply="applyFilters" />

    <div v-if="error && !loading" class="catalogue__message" role="alert">
      <p>Impossible de charger les produits. Vérifiez votre connexion puis réessayez.</p>
      <button type="button" class="catalogue__button" @click="refresh()">Réessayer</button>
    </div>

    <div v-else-if="!loading && products.length === 0" class="catalogue__message">
      <p v-if="outOfRange">Cette page n'existe pas : le catalogue compte {{ totalPages }} pages.</p>
      <p v-else-if="filters.category">Aucun produit dans cette catégorie.</p>
      <p v-else>Aucun produit à afficher pour le moment.</p>
      <NuxtLink v-if="outOfRange" to="/produits" class="catalogue__button" :aria-current="false">
        Revenir à la première page
      </NuxtLink>
      <NuxtLink
        v-else-if="filters.category"
        to="/produits"
        class="catalogue__button"
        :aria-current="false"
      >
        Voir tous les produits
      </NuxtLink>
    </div>

    <ul v-else class="catalogue__grid" :aria-busy="loading">
      <template v-if="loading">
        <li v-for="n in CATALOG_PAGE_SIZE" :key="n"><ProductCardSkeleton /></li>
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
