<script setup lang="ts">
import type { CatalogFilters } from '~/types/catalog'
import type { Category } from '~/types/dummyjson'

const props = defineProps<{
  filters: CatalogFilters
  categories: Category[]
}>()

const emit = defineEmits<{
  apply: [changes: Pick<CatalogFilters, 'category' | 'sortBy' | 'order'>]
}>()

const sortOptions = SORT_OPTIONS
const sortParam = SORT_FORM_PARAM

// Valeurs des menus. Elles ne changent l'URL qu'au clic sur « Appliquer » :
// changer de page dès qu'on choisit une option est déroutant au clavier et au
// lecteur d'écran (WCAG 3.2.2), on parcourt les options avec les flèches.
const category = ref(props.filters.category ?? '')
const sort = ref(sortOptionFor(props.filters).value)

// L'URL peut changer sans ce formulaire (bouton retour, lien de pagination) :
// les menus reprennent alors les valeurs de l'URL, seule source de vérité.
watch(
  () => props.filters,
  (filters) => {
    category.value = filters.category ?? ''
    sort.value = sortOptionFor(filters).value
  },
)

const hasActiveFilters = computed(
  (): boolean => activeFilterCount(props.filters) > 0 || props.filters.sortBy !== null,
)

function onSubmit(): void {
  emit('apply', { category: category.value || null, ...sortFromOption(sort.value) })
}
</script>

<template>
  <!-- Vrai formulaire GET : sans JavaScript, le navigateur l'envoie à /produits et le serveur
       redirige vers l'URL canonique. Avec JavaScript, la navigation se fait sans rechargement. -->
  <form
    class="toolbar"
    method="get"
    action="/produits"
    aria-label="Filtrer et trier les produits"
    @submit.prevent="onSubmit"
  >
    <!-- Conservés à l'envoi sans JavaScript : la recherche (#3) et les prix (#5). -->
    <input v-if="filters.q" type="hidden" name="q" :value="filters.q" />
    <input
      v-if="filters.minPrice !== null"
      type="hidden"
      name="minPrice"
      :value="filters.minPrice"
    />
    <input
      v-if="filters.maxPrice !== null"
      type="hidden"
      name="maxPrice"
      :value="filters.maxPrice"
    />

    <div class="toolbar__field">
      <label for="filter-category">Catégorie</label>
      <select id="filter-category" v-model="category" name="category">
        <option value="">Toutes les catégories</option>
        <option v-for="item in categories" :key="item.slug" :value="item.slug">
          {{ item.name }}
        </option>
      </select>
    </div>

    <div class="toolbar__field">
      <label for="filter-sort">Trier par</label>
      <select id="filter-sort" v-model="sort" :name="sortParam">
        <option v-for="option in sortOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="toolbar__actions">
      <button type="submit" class="toolbar__button">Appliquer</button>
      <NuxtLink v-if="hasActiveFilters" to="/produits" class="toolbar__reset">
        Effacer les filtres
      </NuxtLink>
    </div>
  </form>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.toolbar__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.toolbar__field select {
  min-width: 12rem;
  padding: 0.5rem 0.75rem;
  font: inherit;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
  background: #fff;
}
.toolbar__actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.toolbar__button {
  padding: 0.5rem 1rem;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: #1f2937;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}
.toolbar__reset {
  color: inherit;
}
.toolbar select:focus-visible,
.toolbar__button:focus-visible,
.toolbar__reset:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
</style>
