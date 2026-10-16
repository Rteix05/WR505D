<script setup lang="ts">
// Une instance de page par produit : passer de /produits/1 à /produits/2 recharge tout
// (galerie remise sur la première image, message d'ajout effacé).
definePageMeta({ key: (route) => route.fullPath })

const route = useRoute()
const config = useRuntimeConfig()
const api = useApi()
const cart = useCartStore()

/** Vraie 404 (statut HTTP compris) : page d'erreur rendue par le serveur, pas une page vide. */
function notFound(): never {
  throw createError({
    statusCode: 404,
    statusMessage: 'Product not found',
    // Titre affiché par error.vue (le statusMessage reste en ASCII : il part dans l'en-tête HTTP).
    data: { title: 'Produit introuvable' },
    fatal: true,
  })
}

const id = parseProductId(route.params.id) ?? notFound()

const {
  data: product,
  error,
  refresh,
  status,
} = await useAsyncData(`product-${id}`, () => api.getProduct(id))
// DummyJSON répond 404 pour un identifiant inconnu : on le transmet tel quel au navigateur.
// Une autre erreur (réseau, 500) n'est pas une 404 : on propose de réessayer.
if (httpStatusOf(error.value) === 404) notFound()

// Fiche existante seulement : une 404 a déjà levé `notFound()` plus haut, et une erreur réseau
// (produit non chargé) n'ajoute rien. Au rendu serveur comme dans le navigateur : sans effet
// si le produit est déjà en tête.
const recentlyViewed = useRecentlyViewedStore()
if (product.value) {
  const { price, rating, discountPercentage, thumbnail } = product.value
  recentlyViewed.visit({
    id,
    title: product.value.title,
    price,
    rating,
    discountPercentage,
    thumbnail,
  })
}

const images = computed((): string[] => {
  if (!product.value) return []
  return product.value.images.length > 0 ? product.value.images : [product.value.thumbnail]
})
const price = computed((): string =>
  product.value ? formatCents(toCents(product.value.price)) : '',
)
const badge = computed((): string | null =>
  product.value ? discountBadge(product.value.discountPercentage) : null,
)
const rating = computed((): string => (product.value ? formatRating(product.value.rating) : ''))
const stock = computed(() => productStock(product.value?.stock ?? 0))
const inCart = computed(
  (): number => cart.items.find((item) => item.productId === id)?.quantity ?? 0,
)

const cartMessage = ref('')

function addToCart(): void {
  if (!product.value) return
  const { price: unitPrice, category, stock: available, title } = product.value
  // Le store borne au stock et explique pourquoi s'il refuse ; sinon on confirme l'ajout.
  cartMessage.value =
    cart.add({ id, price: unitPrice, category, stock: available }) ??
    `« ${title} » a été ajouté au panier.`
}

const title = computed((): string => product.value?.title ?? 'Produit')
const description = computed((): string => seoDescription(product.value?.description ?? ''))
const canonical = computed((): string => `${config.public.siteUrl}/produits/${id}`)

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: () => images.value[0],
  ogImageAlt: title,
  ogType: 'website',
  ogUrl: canonical,
  twitterCard: 'summary_large_image',
})
useHead({ link: [{ rel: 'canonical', href: canonical }] })
</script>

<template>
  <div class="product-page">
    <nav aria-label="Fil d'Ariane" class="breadcrumb">
      <ol>
        <li><NuxtLink to="/produits">Produits</NuxtLink></li>
        <li aria-current="page">{{ title }}</li>
      </ol>
    </nav>

    <div v-if="error && status !== 'pending'" class="product-page__error" role="alert">
      <p>Impossible de charger ce produit. Vérifiez votre connexion puis réessayez.</p>
      <button type="button" class="product-page__button" @click="refresh()">Réessayer</button>
    </div>

    <article v-else-if="product" class="product" aria-labelledby="product-title">
      <ProductGallery :images="images" :title="product.title" />

      <div class="product__info">
        <h1 id="product-title" class="product__title">{{ product.title }}</h1>
        <p v-if="product.brand" class="product__brand">Marque : {{ product.brand }}</p>

        <p class="product__rating">
          <span aria-hidden="true">★</span>
          <span class="visually-hidden">Note :</span>
          {{ rating }}<span class="visually-hidden"> sur 5</span>
          <span class="product__reviews"> ({{ product.reviews.length }} avis) </span>
        </p>

        <!-- Encadré d'achat : prix, stock et actions réunis au même endroit. -->
        <div class="product__buy">
          <p class="product__price">
            {{ price }}
            <span v-if="badge" class="product__badge">
              <span class="visually-hidden">Remise de</span>
              {{ badge }}
            </span>
          </p>

          <p id="product-stock" class="product__stock" :class="`product__stock--${stock.level}`">
            {{ stock.label }}
          </p>

          <div class="product__actions">
            <!-- Bouton désactivé seulement en rupture (demandé par l'issue) : il l'est dès
                 l'affichage, donc aucun focus n'est perdu. aria-describedby lit le stock avec. -->
            <button
              type="button"
              class="btn product__add"
              :disabled="stock.level === 'out'"
              aria-describedby="product-stock"
              @click="addToCart"
            >
              Ajouter au panier
            </button>
            <CompareButton
              :product="{ id: product.id, title: product.title, thumbnail: product.thumbnail }"
            />
          </div>
          <!-- Toujours présente : une zone role="status" n'est annoncée que si elle existait déjà. -->
          <p class="product__cart-status" role="status">{{ cartMessage }}</p>
          <p v-if="inCart > 0" class="product__in-cart">
            Déjà {{ inCart }} dans votre panier. <NuxtLink to="/panier">Voir le panier</NuxtLink>
          </p>
        </div>

        <h2 class="product__subtitle">Description</h2>
        <p>{{ product.description }}</p>

        <h2 class="product__subtitle">Informations</h2>
        <dl class="product__details">
          <div>
            <dt>Garantie</dt>
            <dd>{{ product.warrantyInformation }}</dd>
          </div>
          <div>
            <dt>Livraison</dt>
            <dd>{{ product.shippingInformation }}</dd>
          </div>
          <div>
            <dt>Retours</dt>
            <dd>{{ product.returnPolicy }}</dd>
          </div>
        </dl>
      </div>
    </article>

    <ProductRecentlyViewed v-if="product" :exclude-id="id" />
  </div>
</template>

<style scoped>
.breadcrumb ol {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
}
.breadcrumb li + li::before {
  content: '/';
  margin-right: 0.5rem;
  color: var(--color-border-strong);
}
.product {
  display: grid;
  gap: 2rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  align-items: start;
}
.product__info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.product__info p,
.product__title {
  margin: 0;
}
.product__brand,
.product__rating {
  color: var(--color-text-muted);
}
.product__price {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  font-size: var(--text-3xl);
  font-weight: 800;
  color: var(--color-heading);
}
.product__badge {
  padding: 0.125rem 0.5rem;
  font-size: 0.875rem;
  color: var(--color-on-primary);
  background: var(--color-danger);
  border-radius: 999px;
}
.product__stock {
  font-weight: 600;
}
.product__stock--in {
  color: var(--color-success);
}
.product__stock--low {
  color: var(--color-warning-text);
}
.product__stock--out {
  color: var(--color-danger);
}
.product__subtitle {
  margin: 1rem 0 0;
  font-size: 1.125rem;
}
.product__details {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}
.product__details dt {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
.product__details dd {
  margin: 0;
}
.product__buy {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.product__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}
/* Mêmes dimensions pour « Ajouter » et « Comparer » : deux boutons de hauteur égale. */
.product__actions :deep(.compare-button) {
  align-self: auto;
}
.product-page__button {
  align-self: flex-start;
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-4);
  font: inherit;
  font-weight: 600;
  color: var(--color-on-primary);
  cursor: pointer;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
}
.product-page__error {
  padding: 1rem;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
}
:focus-visible {
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
