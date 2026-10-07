<script setup lang="ts">
import type { CompareSummary } from '~/types/compare'

const compare = useCompareStore()
const config = useRuntimeConfig()

// Après un rechargement, le cookie ne donne que des identifiants : titre et miniature sont
// rechargés (3 appels légers au plus, `select`). Au premier rendu, la barre est déjà dans le HTML.
// `onServerPrefetch` de useAsyncData : le serveur attend la réponse avant d'envoyer la page.
useAsyncData(
  'compare-bar',
  async () => {
    const ids = compare.unknownIds
    if (ids.length === 0) return ids
    // allSettled : un produit en échec n'empêche pas d'afficher les autres.
    const results = await Promise.allSettled(
      ids.map((id) =>
        $fetch<CompareSummary>(`/products/${id}`, {
          baseURL: config.public.apiBase,
          query: { select: 'title,thumbnail' },
        }),
      ),
    )
    const { products, missingIds } = sortCompareResults(ids, results, httpStatusOf)
    compare.remember(products)
    // 404 : cookie ancien ou modifié à la main, l'identifiant ne désigne aucun produit.
    // Une autre erreur (réseau) garde l'identifiant : le produit existe peut-être.
    compare.drop(missingIds)
    // Jamais `null` : Nuxt ne réutilise le résultat transmis par le serveur que s'il n'est pas
    // nul. Avec `null`, le navigateur relancerait cette fonction au chargement (review de #62).
    return ids
  },
  { watch: [() => compare.unknownIds] },
)

const link = computed((): string | null => compareLink(compare.ids))
const label = computed((): string => compareBarLabel(compare.count))

const removeButtons = ref<HTMLButtonElement[]>([])

/** Retire un produit puis garde le focus dans la barre : le bouton cliqué disparaît. */
async function onRemove(id: number): Promise<void> {
  const index = compare.ids.indexOf(id)
  compare.remove(id)
  await nextTick()
  // Le suivant a pris la place du retiré ; à défaut, le précédent.
  const buttons = removeButtons.value.filter(Boolean)
  buttons[Math.min(index, buttons.length - 1)]?.focus()
}
</script>

<template>
  <!-- Toujours présente, même barre vide : une zone aria-live n'est annoncée que si elle
       existait déjà dans la page. Elle sert aux boutons « Comparer » de tout le site.
       `aria-live` seul, sans `role="status"` : cette zone est sur toutes les pages, et les tests
       du catalogue, des filtres et de la recherche cherchent LEUR zone `role="status"` (une seule). -->
  <p class="visually-hidden" aria-live="polite" aria-atomic="true">{{ compare.announcement }}</p>

  <!-- `sticky` et pas `fixed` : la barre reste dans le flux, entre le contenu et le pied de page.
       Elle ne recouvre donc jamais la fin de la page, sans marge à compenser. -->
  <aside v-if="compare.count > 0" class="compare-bar" aria-label="Comparateur de produits">
    <ul class="compare-bar__items" aria-label="Produits à comparer">
      <li v-for="item in compare.items" :key="item.id" class="compare-bar__item">
        <img
          v-if="item.thumbnail"
          class="compare-bar__thumb"
          :src="item.thumbnail"
          alt=""
          width="48"
          height="48"
        />
        <span v-else class="compare-bar__thumb compare-bar__thumb--empty" aria-hidden="true" />
        <span class="compare-bar__title">{{ item.title }}</span>
        <button
          ref="removeButtons"
          type="button"
          class="compare-bar__remove"
          :aria-label="compareRemoveName(item.title)"
          @click="onRemove(item.id)"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <path
              d="M4 4l8 8M12 4l-8 8"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </li>
    </ul>
    <NuxtLink v-if="link" :to="link" class="compare-bar__link">{{ label }}</NuxtLink>
  </aside>
</template>

<style scoped>
.compare-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: #fff;
  border-top: 2px solid #1f2937;
  box-shadow: 0 -2px 8px rgb(0 0 0 / 12%);
}
.compare-bar__items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.compare-bar__item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  max-width: 16rem;
}
.compare-bar__thumb {
  flex: none;
  width: 3rem;
  height: 3rem;
  object-fit: contain;
  background: #f3f4f6;
  border-radius: 0.375rem;
}
.compare-bar__title {
  overflow: hidden;
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.compare-bar__remove {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  /* 44 px : zone de clic confortable au doigt, même si l'icône est petite. */
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  color: #1f2937;
  background: transparent;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
  cursor: pointer;
}
.compare-bar__remove:hover {
  background: #f3f4f6;
}
.compare-bar__link {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.5rem 1rem;
  font-weight: 600;
  color: #fff;
  text-decoration: none;
  background: #1f2937;
  border-radius: 0.375rem;
}
.compare-bar__remove:focus-visible,
.compare-bar__link:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
/* Petit écran : barre compacte (miniatures sur une ligne, lien pleine largeur). Les titres ne
   sont plus affichés mais restent lus par les lecteurs d'écran, et nommés dans les boutons. */
@media (max-width: 40rem) {
  .compare-bar {
    padding: 0.5rem 1rem;
  }
  .compare-bar__items {
    flex-wrap: nowrap;
    gap: 0.5rem;
  }
  .compare-bar__title {
    position: absolute;
    width: 1px;
    height: 1px;
    clip: rect(0 0 0 0);
  }
  .compare-bar__link {
    justify-content: center;
    width: 100%;
  }
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

<style>
/* La barre collante peut recouvrir un élément qui reçoit le focus (WCAG 2.4.11) : le navigateur
   garde de la place sous l'élément focalisé quand il fait défiler la page. */
:root:has(.compare-bar) {
  scroll-padding-bottom: 7rem;
}
</style>
