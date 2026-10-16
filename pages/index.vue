<script setup lang="ts">
const config = useRuntimeConfig()
const api = useApi()

useSeoMeta({
  title: 'Accueil',
  description: 'ChampaShop, la boutique en ligne rapide, bien référencée et accessible.',
  ogTitle: 'ChampaShop',
  ogDescription: 'ChampaShop, la boutique en ligne rapide, bien référencée et accessible.',
  ogType: 'website',
  ogUrl: config.public.siteUrl,
})

// Les mieux notés : 8 produits, chargés côté serveur (dans le HTML, sans JavaScript).
// Résultat gardé en mémoire pendant la navigation : revenir à l'accueil ne refait pas l'appel.
const { data: featured, error } = await useAsyncData(
  'home-featured',
  () => api.getProducts({ limit: 8, sortBy: 'rating', order: 'desc' }),
  { getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key] },
)
const products = computed(() => featured.value?.products ?? [])

// Catégories mises en avant : liste fixe (les slugs DummyJSON ne changent pas), donc aucun appel
// API de plus sur l'accueil. Chaque tuile mène au catalogue déjà filtré.
const categories = [
  { slug: 'beauty', label: 'Beauté' },
  { slug: 'skin-care', label: 'Soins de la peau' },
  { slug: 'fragrances', label: 'Parfums' },
  { slug: 'furniture', label: 'Mobilier' },
  { slug: 'home-decoration', label: 'Décoration' },
  { slug: 'kitchen-accessories', label: 'Cuisine' },
  { slug: 'laptops', label: 'Ordinateurs' },
  { slug: 'smartphones', label: 'Smartphones' },
] as const

// Avantages : les règles réelles de la boutique (utils/promotions.ts), jamais écrites à la main.
const perks = [
  {
    id: 'shipping',
    title: 'Livraison',
    text: `${formatCents(SHIPPING_CENTS)}, offerte dès ${formatCents(FREE_SHIPPING_MIN_CENTS)} (hors mobilier).`,
  },
  {
    id: 'beauty',
    title: 'Remise beauté',
    text: `−${BEAUTY_PERCENT} % sur la beauté dès ${BEAUTY_MIN_ITEMS} articles.`,
  },
  {
    id: 'code',
    title: `Code ${PROMO_CODE}`,
    text: `−${formatCents(PROMO_AMOUNT_CENTS)} au-delà de ${formatCents(PROMO_MIN_SUBTOTAL_CENTS)} d'achats.`,
  },
] as const
</script>

<template>
  <div class="home">
    <!-- Bandeau : la recherche est l'action principale (schéma « Marketplace »). Un vrai
         formulaire GET : il fonctionne sans JavaScript. -->
    <section class="hero" aria-labelledby="home-title">
      <h1 id="home-title" class="hero__title">Bienvenue sur ChampaShop</h1>
      <p class="hero__lead">
        De la beauté au high-tech, des centaines de produits et des remises qui s'appliquent toutes
        seules.
      </p>
      <form class="hero__search" role="search" method="get" action="/produits">
        <label for="home-search">Rechercher un produit</label>
        <div class="hero__row">
          <input
            id="home-search"
            name="q"
            type="search"
            maxlength="100"
            autocomplete="off"
            spellcheck="false"
            placeholder="Ex. : mascara, iPhone, table…"
          />
          <button type="submit" class="btn hero__button">Rechercher</button>
        </div>
      </form>
    </section>

    <ul class="perks" aria-label="Nos avantages">
      <li v-for="perk in perks" :key="perk.id" class="perk">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
          <g
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <template v-if="perk.id === 'shipping'">
              <path d="M3 7h11v9H3z M14 10h4l3 3v3h-7z" />
              <circle cx="7" cy="17.5" r="1.8" />
              <circle cx="17" cy="17.5" r="1.8" />
            </template>
            <template v-else-if="perk.id === 'beauty'">
              <path d="M19 5 5 19" />
              <circle cx="7" cy="7" r="2.2" />
              <circle cx="17" cy="17" r="2.2" />
            </template>
            <path v-else d="M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V8Z M10 8v10" />
          </g>
        </svg>
        <div>
          <p class="perk__title">{{ perk.title }}</p>
          <p class="perk__text">{{ perk.text }}</p>
        </div>
      </li>
    </ul>

    <section aria-labelledby="home-categories">
      <h2 id="home-categories" class="section-title">Parcourir par catégorie</h2>
      <ul class="categories">
        <li v-for="(category, index) in categories" :key="category.slug">
          <NuxtLink
            :to="{ path: '/produits', query: { category: category.slug } }"
            class="category"
            :class="`category--${index % 4}`"
          >
            {{ category.label }}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <path
                d="M5 12h14m-5-5 5 5-5 5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section aria-labelledby="home-featured">
      <div class="section-head">
        <h2 id="home-featured" class="section-title">Les mieux notés</h2>
        <NuxtLink to="/produits?sortBy=rating&order=desc">Voir tout le catalogue</NuxtLink>
      </div>
      <p v-if="error" class="home__error">
        Impossible de charger les produits pour le moment.
        <NuxtLink to="/produits">Parcourir le catalogue</NuxtLink>
      </p>
      <ul v-else class="products">
        <li v-for="product in products" :key="product.id">
          <ProductCard :product="product" :heading-level="3" />
        </li>
      </ul>
    </section>

    <ProductRecentlyViewed />
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: var(--space-7);
}

/* --- Bandeau ---------------------------------------------------------------------------- */
.hero {
  padding: var(--space-7) var(--space-5);
  color: var(--color-on-primary);
  background: linear-gradient(135deg, var(--color-heading), var(--color-primary));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
.hero__title {
  margin: 0 0 var(--space-3);
  color: var(--color-on-primary);
}
.hero__lead {
  max-width: 38rem;
  margin: 0 0 var(--space-5);
  font-size: var(--text-lg);
}
.hero__search {
  max-width: 40rem;
}
.hero__search label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: 600;
}
.hero__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.hero__row input {
  flex: 1 1 14rem;
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-4);
  font: inherit;
  color: var(--color-text);
  background: var(--color-surface);
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-md);
}
.hero__button {
  /* Accent : l'action principale du bandeau ressort sur le fond vert. */
  background: var(--color-accent);
  border-color: var(--color-accent);
}
.hero__button:hover {
  background: var(--color-on-accent);
  color: var(--color-accent);
  border-color: var(--color-on-accent);
}

/* --- Avantages -------------------------------------------------------------------------- */
.perks {
  display: grid;
  gap: var(--space-4);
  padding: 0;
  margin: 0;
  list-style: none;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
}
.perk {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-4);
  color: var(--color-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.perk svg {
  flex: none;
}
.perk p {
  margin: 0;
}
.perk__title {
  font-weight: 700;
  color: var(--color-heading);
}
.perk__text {
  color: var(--color-text-muted);
}

/* --- Titres de section ------------------------------------------------------------------ */
.section-head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}
.section-title {
  margin: 0 0 var(--space-4);
  font-size: var(--text-2xl);
}
.section-head .section-title {
  margin: 0;
}

/* --- Catégories ------------------------------------------------------------------------- */
.categories {
  display: grid;
  gap: var(--space-3);
  padding: 0;
  margin: 0;
  list-style: none;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
}
.category {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  min-height: 4.5rem;
  padding: var(--space-4);
  font-weight: 700;
  text-decoration: none;
  border-radius: var(--radius-lg);
  transition:
    transform 200ms ease-out,
    box-shadow 200ms ease-out;
}
.category:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
/* Quatre teintes en alternance, chacune avec un texte au contraste ≥ 4,5:1. */
.category--0 {
  color: var(--color-on-primary);
  background: var(--color-primary);
}
.category--1 {
  color: var(--color-on-primary);
  background: var(--color-heading);
}
.category--2 {
  color: var(--color-on-accent);
  background: var(--color-accent);
}
.category--3 {
  color: var(--color-heading);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}
.category:hover.category--0,
.category:hover.category--1,
.category:hover.category--2 {
  color: var(--color-on-primary);
}
.category:hover.category--3 {
  color: var(--color-heading);
}

/* --- Produits --------------------------------------------------------------------------- */
.products {
  display: grid;
  gap: var(--space-3);
  padding: 0;
  margin: 0;
  list-style: none;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
}
.home__error {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

@media (min-width: 40rem) {
  .hero {
    padding: var(--space-8) var(--space-7);
  }
  .products {
    grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr));
  }
}
</style>
