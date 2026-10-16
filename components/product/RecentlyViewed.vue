<script setup lang="ts">
const props = defineProps<{
  /** Produit de la fiche en cours : il n'a pas à s'afficher dans sa propre liste. */
  excludeId?: number
}>()

const store = useRecentlyViewedStore()
const api = useApi()

// Seulement les champs d'une carte : 10 produits pèsent ~2 Ko (15 Ko sans `select`).
const CARD_FIELDS = ['title', 'price', 'rating', 'discountPercentage', 'thumbnail'] as const

// Seuls les produits dont on ignore encore le titre sont chargés : un produit qu'on vient de
// visiter est déjà connu (store.visit), donc revenir à l'accueil ne refait aucun appel.
// Après un rechargement, il ne reste que les identifiants du cookie : un appel par produit, en
// parallèle (`getProductsByIds`), que le serveur attend avant d'envoyer la page.
useAsyncData(
  'recently-viewed',
  async () => {
    const ids = store.unknownIds
    if (ids.length === 0) return ids
    const { products, missingIds } = await api.getProductsByIds(ids, { select: CARD_FIELDS })
    store.remember(products)
    // 404 : produit supprimé ou cookie modifié à la main. Les échecs réseau ne sont pas
    // retirés (le produit existe peut-être) : il ne s'affiche simplement pas cette fois.
    store.drop(missingIds)
    // Jamais `null` : Nuxt ne réutilise le résultat du serveur que s'il n'est pas nul, sinon le
    // navigateur relancerait cette fonction au chargement (leçon de #62).
    return ids
  },
  { watch: [() => store.unknownIds] },
)

const products = computed(() =>
  store.ids
    .filter((id) => id !== props.excludeId)
    .flatMap((id) => {
      const product = store.known[id]
      return product ? [product] : []
    }),
)

// Après « Effacer », la liste disparaît : on garde le titre et une confirmation pour que le
// focus ait un point d'arrivée (le bouton cliqué n'existe plus).
const cleared = ref(false)
const announcement = ref('')
const title = ref<HTMLHeadingElement | null>(null)

async function onClear(): Promise<void> {
  store.clear()
  cleared.value = true
  announcement.value = 'Historique effacé.'
  await nextTick()
  title.value?.focus()
}
</script>

<template>
  <!-- Toujours présente, même sans historique : une zone aria-live n'est annoncée que si elle
       existait déjà. `aria-live` seul, sans `role="status"` : les tests du catalogue cherchent
       leur propre zone `role="status"` (une seule par page). -->
  <p class="visually-hidden" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

  <section v-if="products.length > 0 || cleared" class="recent" aria-labelledby="recent-title">
    <div class="recent__header">
      <h2 id="recent-title" ref="title" tabindex="-1" class="recent__title">
        Produits vus récemment
      </h2>
      <!-- Sans JavaScript, ce bouton ne ferait rien : il n'existe qu'avec JavaScript. -->
      <ClientOnly>
        <button v-if="products.length > 0" type="button" class="recent__clear" @click="onClear">
          Effacer l'historique
        </button>
      </ClientOnly>
    </div>

    <ul v-if="products.length > 0" class="recent__list">
      <li v-for="product in products" :key="product.id">
        <ProductCard :product="product" :heading-level="3" />
      </li>
    </ul>
    <p v-else>Votre historique a été effacé.</p>
  </section>
</template>

<style scoped>
.recent {
  margin-top: 2rem;
}
.recent__header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.recent__title {
  margin: 0;
  font-size: 1.25rem;
}
.recent__title:focus {
  outline: none;
}
.recent__list {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}
.recent__clear {
  min-height: 2.75rem;
  padding: 0.5rem 0.875rem;
  font: inherit;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.recent__clear:hover {
  background: var(--color-surface-muted);
}
.recent__clear:focus-visible {
  outline: 3px solid var(--color-focus);
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
