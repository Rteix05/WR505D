<script setup lang="ts">
import type { CatalogFilters } from '~/types/catalog'
import type { Category } from '~/types/dummyjson'

const props = defineProps<{
  filters: CatalogFilters
  categories: Category[]
}>()

const emit = defineEmits<{
  apply: [changes: Pick<CatalogFilters, 'category' | 'sortBy' | 'order' | 'minPrice' | 'maxPrice'>]
}>()

const sortOptions = SORT_OPTIONS
const sortParam = SORT_FORM_PARAM

// Valeurs des menus. Elles ne changent l'URL qu'au clic sur « Appliquer » :
// changer de page dès qu'on choisit une option est déroutant au clavier et au
// lecteur d'écran (WCAG 3.2.2), on parcourt les options avec les flèches.
const category = ref(props.filters.category ?? '')
const sort = ref(sortOptionFor(props.filters).value)
// Texte saisi, pas un nombre : « 10, » ou « abc » doivent rester affichés pour être corrigés.
const minPriceText = ref(priceInputText(props.filters.minPrice))
const maxPriceText = ref(priceInputText(props.filters.maxPrice))
const minPriceError = ref('')
const maxPriceError = ref('')
const minPriceInput = ref<HTMLInputElement | null>(null)
const maxPriceInput = ref<HTMLInputElement | null>(null)

const PRICE_ERROR = 'Saisissez un prix positif, avec 2 décimales au plus (ex. 19,99).'

// L'URL peut changer sans ce formulaire (bouton retour, lien de pagination) :
// les menus reprennent alors les valeurs de l'URL, seule source de vérité.
watch(
  () => props.filters,
  (filters) => {
    category.value = filters.category ?? ''
    sort.value = sortOptionFor(filters).value
    minPriceText.value = priceInputText(filters.minPrice)
    maxPriceText.value = priceInputText(filters.maxPrice)
    minPriceError.value = ''
    maxPriceError.value = ''
  },
)

const hasActiveFilters = computed(
  (): boolean => activeFilterCount(props.filters) > 0 || props.filters.sortBy !== null,
)

function onSubmit(): void {
  const min = parsePriceInput(minPriceText.value)
  const max = parsePriceInput(maxPriceText.value)
  minPriceError.value = min.valid ? '' : PRICE_ERROR
  maxPriceError.value = max.valid ? '' : PRICE_ERROR
  // Saisie invalide : rien n'est appliqué, le focus va sur le premier champ à corriger.
  if (!min.valid) return minPriceInput.value?.focus()
  if (!max.valid) return maxPriceInput.value?.focus()

  // Bornes inversées (min 50, max 10) : remises dans l'ordre, comme pour l'URL (#4).
  const [minPrice, maxPrice] =
    min.value !== null && max.value !== null && min.value > max.value
      ? [max.value, min.value]
      : [min.value, max.value]

  emit('apply', {
    category: category.value || null,
    ...sortFromOption(sort.value),
    minPrice,
    maxPrice,
  })
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
    <!-- Conservée à l'envoi sans JavaScript : la recherche (#3). Les prix sont de vrais champs. -->
    <input v-if="filters.q" type="hidden" name="q" :value="filters.q" />

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

    <!-- Champs texte et non type="number" : la virgule française y est refusée par certains
         navigateurs, et les flèches du clavier y changeraient la valeur par erreur. -->
    <fieldset class="toolbar__price">
      <legend>Prix (€)</legend>
      <div class="toolbar__field">
        <label for="filter-min-price">Minimum</label>
        <input
          id="filter-min-price"
          ref="minPriceInput"
          v-model="minPriceText"
          name="minPrice"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0"
          :aria-invalid="minPriceError ? 'true' : undefined"
          :aria-describedby="minPriceError ? 'filter-min-price-error' : undefined"
        />
        <p v-if="minPriceError" id="filter-min-price-error" class="toolbar__error" role="alert">
          {{ minPriceError }}
        </p>
      </div>
      <div class="toolbar__field">
        <label for="filter-max-price">Maximum</label>
        <input
          id="filter-max-price"
          ref="maxPriceInput"
          v-model="maxPriceText"
          name="maxPrice"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="Sans limite"
          :aria-invalid="maxPriceError ? 'true' : undefined"
          :aria-describedby="maxPriceError ? 'filter-max-price-error' : undefined"
        />
        <p v-if="maxPriceError" id="filter-max-price-error" class="toolbar__error" role="alert">
          {{ maxPriceError }}
        </p>
      </div>
    </fieldset>

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
.toolbar__price {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0;
  padding: 0;
  border: none;
}
.toolbar__price legend {
  padding: 0;
  margin-bottom: 0.25rem;
  font-weight: 600;
}
.toolbar__field input {
  width: 8rem;
  padding: 0.5rem 0.75rem;
  font: inherit;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
}
.toolbar__field input[aria-invalid='true'] {
  border-color: #b91c1c;
}
.toolbar__error {
  max-width: 16rem;
  margin: 0;
  color: #b91c1c;
  font-size: 0.875rem;
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
.toolbar__field input:focus-visible,
.toolbar__button:focus-visible,
.toolbar__reset:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
</style>
