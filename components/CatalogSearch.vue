<script setup lang="ts">
import type { CatalogFilters } from '~/types/catalog'

const props = defineProps<{
  filters: CatalogFilters
}>()

const emit = defineEmits<{
  search: [q: string]
}>()

const maxLength = SEARCH_MAX_LENGTH
const text = ref(props.filters.q)

function emitIfChanged(value: string): void {
  const q = value.trim()
  if (q !== props.filters.q) emit('search', q)
}

// Une recherche 300 ms après la dernière frappe, pas une par lettre.
const scheduleSearch = debounce(emitIfChanged, SEARCH_DEBOUNCE_MS)

function onInput(): void {
  scheduleSearch(text.value)
}

/** Entrée : inutile d'attendre la fin du délai. */
function onSubmit(): void {
  scheduleSearch(text.value)
  scheduleSearch.flush()
}

// L'URL peut changer sans ce champ (bouton retour, « Effacer les filtres ») : il reprend
// alors la valeur de l'URL. Sauf pendant la frappe : la réponse à « pho » ne doit pas
// effacer le « n » tapé entre-temps.
watch(
  () => props.filters.q,
  (q) => {
    if (!scheduleSearch.pending() && q !== text.value.trim()) text.value = q
  },
)

onBeforeUnmount(() => scheduleSearch.cancel())

// Sans JavaScript, le navigateur envoie le formulaire lui-même : les autres filtres
// partent en champs cachés pour ne pas être perdus. La page revient à 1 (absente).
const hiddenFields = computed(() =>
  Object.entries(toCatalogQuery({ ...props.filters, q: '', page: 1 })),
)
</script>

<template>
  <form
    class="search"
    role="search"
    method="get"
    action="/produits"
    aria-label="Rechercher dans le catalogue"
    @submit.prevent="onSubmit"
  >
    <input
      v-for="[name, value] in hiddenFields"
      :key="name"
      type="hidden"
      :name="name"
      :value="value"
    />
    <label for="catalog-search">Rechercher un produit</label>
    <div class="search__row">
      <input
        id="catalog-search"
        v-model="text"
        class="search__input"
        type="search"
        name="q"
        :maxlength="maxLength"
        autocomplete="off"
        spellcheck="false"
        placeholder="Ex. : mascara, iPhone, table…"
        @input="onInput"
      />
      <button type="submit" class="search__button">Rechercher</button>
    </div>
  </form>
</template>

<style scoped>
.search {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}
.search__row {
  display: flex;
  gap: 0.5rem;
}
.search__input {
  flex: 1;
  min-width: 0;
  max-width: 32rem;
  padding: 0.5rem 0.75rem;
  font: inherit;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
}
.search__button {
  padding: 0.5rem 1rem;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: #1f2937;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}
.search__input:focus-visible,
.search__button:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
</style>
