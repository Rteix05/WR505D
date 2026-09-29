<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{
  current: number
  totalPages: number
}>()

const route = useRoute()

const items = computed((): PaginationItem[] => paginationItems(props.current, props.totalPages))

// Des liens et non des boutons : ils fonctionnent sans JavaScript, s'ouvrent dans un
// nouvel onglet et sont suivis par les moteurs de recherche. Les autres paramètres
// (recherche, filtres) sont conservés ; la page 1 n'a pas de `?page=` (une seule URL).
function pageLink(page: number): RouteLocationRaw {
  return { query: { ...route.query, page: page > 1 ? String(page) : undefined } }
}
</script>

<template>
  <nav v-if="totalPages > 1" class="pagination" aria-label="Pagination">
    <ul class="pagination__list">
      <li>
        <NuxtLink
          v-if="current > 1"
          :to="pageLink(current - 1)"
          class="pagination__link"
          rel="prev"
          :aria-current="false"
        >
          <span aria-hidden="true">←</span> Précédente
        </NuxtLink>
      </li>
      <li v-for="(item, index) in items" :key="`${item}-${index}`">
        <span v-if="item === 'ellipsis'" class="pagination__ellipsis" aria-hidden="true">…</span>
        <NuxtLink
          v-else
          :to="pageLink(item)"
          class="pagination__link"
          :aria-current="item === current ? 'page' : false"
        >
          <span class="visually-hidden">Page </span>{{ item }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink
          v-if="current < totalPages"
          :to="pageLink(current + 1)"
          class="pagination__link"
          rel="next"
          :aria-current="false"
        >
          Suivante <span aria-hidden="true">→</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.pagination__list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin: 2rem 0 0;
  padding: 0;
  list-style: none;
}
.pagination__link,
.pagination__ellipsis {
  display: inline-block;
  min-width: 2.5rem;
  padding: 0.5rem 0.75rem;
  text-align: center;
}
.pagination__link {
  color: inherit;
  text-decoration: none;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
}
.pagination__link[aria-current='page'] {
  color: #fff;
  background: #1f2937;
  border-color: #1f2937;
  font-weight: 700;
}
.pagination__link:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
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
