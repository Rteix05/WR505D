<script setup lang="ts">
import type { CatalogFilters } from '~/types/catalog'
import type { ProductSummary, ProductsResponse } from '~/types/dummyjson'

const route = useRoute()
const config = useRuntimeConfig()
const api = useApi()

// L'URL est la seule source de vérité : page, recherche, catégorie, tri et prix
// sont relus depuis la query à chaque changement, jamais copiés dans un ref.
const filters = computed((): CatalogFilters => parseCatalogQuery(route.query))

// Formulaire de filtres envoyé sans JavaScript (?category=…&sort=…) : on redirige vers
// l'URL canonique (sortBy + order, valeurs par défaut omises). Une vue = une URL.
// Idem pour la recherche envoyée vide (`?q=`) ou avec des espaces (`?q=+phone+`).
const rawSearch = route.query.q
if (
  SORT_FORM_PARAM in route.query ||
  (typeof rawSearch === 'string' && rawSearch !== filters.value.q)
) {
  await navigateTo({ path: '/produits', query: toCatalogQuery(filters.value) }, { replace: true })
}

const { data: categories } = await useAsyncData('categories', () => api.getCategories(), {
  default: () => [],
})

// Exécuté côté serveur au premier affichage (le HTML contient déjà les produits,
// même sans JavaScript), puis côté client à chaque changement de l'URL.
//
// Anti-race : si l'URL change pendant une requête (recherche « pho » puis « phone »),
// `dedupe: 'cancel'` annule la précédente et ignore sa réponse. Son `signal` est passé
// à l'API : la requête réseau elle-même est interrompue, pas seulement son résultat.
// La liste ne contient que les champs d'une carte (`ProductSummary`) : c'est ce que renvoie
// le filtrage local, et une réponse complète de l'API les contient aussi.
const { data, status, error, refresh } = await useAsyncData<ProductsResponse<ProductSummary>>(
  'catalogue',
  async (_nuxtApp, { signal }) => {
    const current = filters.value
    const sort = sortParams(current)
    const params = { ...paginationParams(current.page), ...sort, signal }

    // Filtres que l'API ne sait pas appliquer (prix, ou recherche + catégorie) : un seul
    // appel pour tous les produits concernés, réduits aux champs d'une carte et déjà triés
    // par l'API, puis filtrage et pagination ici. Stratégie expliquée dans docs/filtre-prix.md.
    if (needsLocalFiltering(current)) {
      const all = await api.getAllProductSummaries(current, { ...sort, signal })
      return localPage(filterLocally(all.products, current), current.page)
    }
    if (current.q) return api.searchProducts(current.q, params)
    // DummyJSON a une route dédiée par catégorie ; le tri et la pagination s'y appliquent aussi.
    return current.category
      ? api.getProductsByCategory(current.category, params)
      : api.getProducts(params)
  },
  { watch: [filters], dedupe: 'cancel' },
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
  const search = filters.value.q ? ` pour « ${filters.value.q} »` : ''
  const where = currentCategory.value ? ` dans ${currentCategory.value.name}` : ''
  const price = hasPriceFilter(filters.value) ? ` ${priceRangeLabel(filters.value)}` : ''
  return `${count}${search}${where}${price}, page ${page.value} sur ${totalPages.value}`
})

async function applyFilters(changes: Partial<CatalogFilters>): Promise<void> {
  // updateFilters revient à la page 1 : la page 5 de l'ancien filtre n'a plus de sens.
  await navigateTo({ query: toCatalogQuery(updateFilters(filters.value, changes)) })
}

async function applySearch(q: string): Promise<void> {
  // Une seule entrée d'historique par recherche : la première frappe ajoute une entrée,
  // les suivantes la remplacent. Sinon « Précédent » repasserait par « p », « ph », « pho »…
  await navigateTo(
    { query: toCatalogQuery(updateFilters(filters.value, { q })) },
    { replace: filters.value.q !== '' },
  )
}

/** Lien « Effacer la recherche » : garde la catégorie, le tri et les prix. */
const withoutSearch = computed(() => ({
  query: toCatalogQuery(updateFilters(filters.value, { q: '' })),
}))

const priceFiltered = computed((): boolean => hasPriceFilter(filters.value))

/** Lien « Effacer le filtre de prix » : garde la recherche, la catégorie et le tri. */
const withoutPrice = computed(() => ({
  query: toCatalogQuery(updateFilters(filters.value, { minPrice: null, maxPrice: null })),
}))

/** Aucun résultat : on rappelle tous les filtres actifs, pour comprendre pourquoi. */
const noResultMessage = computed((): string => {
  const current = filters.value
  const parts = ['Aucun produit']
  if (current.q) parts.push(`ne correspond à « ${current.q} »`)
  if (currentCategory.value) parts.push(`dans ${currentCategory.value.name}`)
  else if (current.category) parts.push('dans cette catégorie')
  if (hasPriceFilter(current)) parts.push(priceRangeLabel(current))
  return parts.length > 1 ? `${parts.join(' ')}.` : 'Aucun produit à afficher pour le moment.'
})

// Après un changement de page (pagination), le focus revient sur le titre (et la vue
// remonte) : sinon un utilisateur clavier resterait en bas, sur un lien qui a changé de sens.
// Pas quand la page revient à 1 à cause d'une recherche : le focus doit rester dans le champ.
const heading = ref<HTMLHeadingElement | null>(null)
watch(filters, async (next, previous) => {
  const samePageFilters =
    JSON.stringify(toCatalogQuery({ ...next, page: 1 })) ===
    JSON.stringify(toCatalogQuery({ ...previous, page: 1 }))
  if (next.page === previous.page || !samePageFilters) return
  await nextTick()
  heading.value?.focus()
})

const title = computed((): string => {
  const parts = [
    filters.value.q ? `Recherche « ${filters.value.q} »` : 'Produits',
    currentCategory.value?.name,
  ].filter(Boolean)
  const name = parts.join(' : ')
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
  // Les pages de recherche et de fourchette de prix ne sont pas indexées (une par mot tapé
  // ou par prix saisi : contenu en double à l'infini) ; les liens vers les produits restent suivis.
  robots: () => (filters.value.q || hasPriceFilter(filters.value) ? 'noindex, follow' : undefined),
})
useHead({ link: [{ rel: 'canonical', href: canonical }] })
</script>

<template>
  <section class="catalogue" aria-labelledby="catalogue-title">
    <h1 id="catalogue-title" ref="heading" tabindex="-1" class="catalogue__title">Produits</h1>

    <!-- Toujours présente : une zone de statut n'est annoncée que si elle existait déjà. -->
    <p class="catalogue__status" role="status">{{ statusMessage }}</p>

    <div class="catalogue__filters">
      <CatalogSearch :filters="filters" @search="applySearch" />
      <CatalogToolbar :filters="filters" :categories="categories" @apply="applyFilters" />
    </div>

    <div v-if="error && !loading" class="catalogue__message" role="alert">
      <p>Impossible de charger les produits. Vérifiez votre connexion puis réessayez.</p>
      <button type="button" class="catalogue__button" @click="refresh()">Réessayer</button>
    </div>

    <div v-else-if="!loading && products.length === 0" class="catalogue__message">
      <p v-if="outOfRange">Cette page n'existe pas : le catalogue compte {{ totalPages }} pages.</p>
      <p v-else>{{ noResultMessage }}</p>
      <NuxtLink v-if="outOfRange" to="/produits" class="catalogue__button" :aria-current="false">
        Revenir à la première page
      </NuxtLink>
      <!-- Le prix est le filtre le plus souvent trop étroit : c'est lui qu'on propose de retirer. -->
      <NuxtLink
        v-else-if="priceFiltered"
        :to="withoutPrice"
        class="catalogue__button"
        :aria-current="false"
      >
        Effacer le filtre de prix
      </NuxtLink>
      <NuxtLink
        v-else-if="filters.q"
        :to="withoutSearch"
        class="catalogue__button"
        :aria-current="false"
      >
        Effacer la recherche
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
.catalogue__title {
  margin: 0 0 var(--space-1);
}
.catalogue__title:focus {
  outline: none;
}
.catalogue__status {
  margin: 0 0 var(--space-4);
  color: var(--color-text-muted);
}
/* Recherche et filtres dans un seul panneau, séparé de la liste. */
.catalogue__filters {
  padding: var(--space-4);
  margin-bottom: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.catalogue__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.catalogue__message {
  padding: var(--space-6);
  text-align: center;
  background: var(--color-surface);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
}
.catalogue__button {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-4);
  font: inherit;
  font-weight: 600;
  color: var(--color-on-primary);
  text-decoration: none;
  cursor: pointer;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
}
.catalogue__button:hover {
  color: var(--color-on-primary);
  background: var(--color-primary-hover);
}

@media (min-width: 40rem) {
  .catalogue__grid {
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: var(--space-4);
  }
}
</style>
