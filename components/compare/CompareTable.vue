<script setup lang="ts">
import type { CompareRow, CompareTableProduct } from '~/types/compareTable'

const props = defineProps<{
  products: CompareTableProduct[]
}>()

const onlyDifferences = ref(false)

// Calcul (meilleures valeurs, lignes identiques) dans une fonction pure testée :
// le composant ne fait que l'affichage.
const rows = computed((): CompareRow[] => buildCompareRows(props.products))
const visibleRows = computed((): CompareRow[] =>
  onlyDifferences.value ? rows.value.filter((row) => !row.same) : rows.value,
)
const hiddenCount = computed((): number => rows.value.length - visibleRows.value.length)
/** Avec un seul produit, toutes les lignes sont « identiques » : l'option n'a pas de sens. */
const canFilter = computed((): boolean => props.products.length > 1)

const filterStatus = computed((): string => {
  if (!onlyDifferences.value) return ''
  if (hiddenCount.value === 0) return 'Aucune ligne identique à masquer.'
  return hiddenCount.value > 1
    ? `${hiddenCount.value} lignes identiques masquées.`
    : '1 ligne identique masquée.'
})

const caption = computed((): string =>
  props.products.length > 1
    ? `Comparaison de ${props.products.length} produits`
    : 'Caractéristiques du produit',
)
</script>

<template>
  <div class="compare-table">
    <!-- L'option n'existe qu'avec JavaScript : sans lui, le tableau complet s'affiche,
         plutôt qu'une case à cocher qui ne ferait rien. -->
    <ClientOnly>
      <div v-if="canFilter" class="compare-table__options">
        <input id="compare-only-differences" v-model="onlyDifferences" type="checkbox" />
        <label for="compare-only-differences">Afficher uniquement les différences</label>
      </div>
      <!-- Annonce le nombre de lignes masquées : sans elle, un lecteur d'écran ne saurait pas
           que le tableau a changé. -->
      <p v-if="canFilter" class="compare-table__status" role="status">{{ filterStatus }}</p>
    </ClientOnly>

    <!-- Zone défilante focalisable : au clavier, les flèches font défiler le tableau sur mobile
         (sans tabindex, impossible de l'atteindre ; règle axe « scrollable-region-focusable »). -->
    <div
      class="compare-table__scroll"
      role="region"
      aria-labelledby="compare-table-caption"
      tabindex="0"
    >
      <table>
        <caption id="compare-table-caption">
          <span class="compare-table__caption">{{ caption }}</span>
        </caption>
        <thead>
          <tr>
            <td class="compare-table__corner" />
            <th v-for="product in products" :key="product.id" scope="col">
              <img
                :src="product.thumbnail"
                alt=""
                width="96"
                height="96"
                loading="lazy"
                decoding="async"
              />
              <NuxtLink :to="`/produits/${product.id}`">{{ product.title }}</NuxtLink>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleRows" :key="row.id">
            <th scope="row">{{ row.label }}</th>
            <td
              v-for="(cell, index) in row.cells"
              :key="products[index]?.id ?? index"
              :class="{ 'compare-table__best': row.best.includes(index) }"
            >
              {{ cell }}
              <!-- Libellé texte, lu par les lecteurs d'écran et visible sans les couleurs. -->
              <span v-if="row.best.includes(index)" class="compare-table__badge">
                <span aria-hidden="true">✓</span> {{ row.bestLabel }}
              </span>
            </td>
          </tr>
          <tr v-if="visibleRows.length === 0">
            <td :colspan="products.length + 1">
              Ces produits sont identiques sur toutes les caractéristiques.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="compare-table__note">
      Poids et dimensions : valeurs fournies par l'API, sans unité précisée.
    </p>
  </div>
</template>

<style scoped>
.compare-table__options {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.compare-table__options input {
  width: 1.25rem;
  height: 1.25rem;
}
.compare-table__status:empty {
  margin: 0;
}
.compare-table__scroll {
  /* Le tableau défile dans sa zone, jamais la page entière (mobile). */
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
}
.compare-table__scroll:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
caption {
  padding: 0.75rem 1rem;
  font-weight: 600;
  text-align: left;
}
th,
td {
  padding: 0.75rem 1rem;
  text-align: left;
  vertical-align: top;
  border-top: 1px solid #e5e7eb;
}
thead th {
  min-width: 10rem;
}
thead th img {
  display: block;
  width: 6rem;
  height: 6rem;
  margin-bottom: 0.5rem;
  object-fit: contain;
  background: #f3f4f6;
  border-radius: 0.375rem;
}
thead th a {
  color: inherit;
}
thead th a:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
/* Première colonne figée : en défilant sur mobile, on sait toujours quelle ligne on lit. */
tbody th,
.compare-table__corner {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 8rem;
  background: #f9fafb;
  font-weight: 600;
}
.compare-table__caption {
  /* Le texte reste visible quand le tableau défile horizontalement (mobile) : la légende
     fait toute la largeur du tableau, c'est son contenu qui se colle au bord. */
  position: sticky;
  left: 1rem;
}
.compare-table__best {
  font-weight: 700;
  background: #f0fdf4;
}
.compare-table__badge {
  display: block;
  width: fit-content;
  margin-top: 0.25rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #14532d;
  background: #dcfce7;
  border-radius: 999px;
}
.compare-table__note {
  font-size: 0.875rem;
  color: #4b5563;
}
@media (max-width: 640px) {
  th,
  td {
    padding: 0.5rem 0.75rem;
  }
  tbody th,
  .compare-table__corner {
    min-width: 6.5rem;
  }
  thead th {
    min-width: 8.5rem;
  }
}
</style>
