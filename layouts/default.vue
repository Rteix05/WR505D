<script setup lang="ts">
import { storeToRefs } from 'pinia'

// storeToRefs garde la réactivité en déstructurant le store (une simple déstructuration la perdrait).
const { user } = storeToRefs(useAuthStore())
const cart = useCartStore()

const cartLabel = computed(
  (): string => `Panier, ${cart.itemCount} article${cart.itemCount > 1 ? 's' : ''}`,
)
const shipping = `${formatCents(SHIPPING_CENTS)}, offerte dès ${formatCents(FREE_SHIPPING_MIN_CENTS)}`
</script>

<template>
  <div class="layout">
    <a href="#contenu" class="skip-link">Aller au contenu</a>

    <header class="layout__header">
      <div class="container layout__bar">
        <NuxtLink to="/" class="layout__brand">
          <!-- Logo décoratif : le nom écrit à côté suffit. -->
          <svg class="layout__logo" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="currentColor" />
            <path
              d="M9 12h14l-1.4 10.2a2 2 0 0 1-2 1.8h-7.2a2 2 0 0 1-2-1.8L9 12Z"
              fill="var(--color-on-primary)"
            />
            <path
              d="M12.5 12.5V11a3.5 3.5 0 0 1 7 0v1.5"
              fill="none"
              stroke="var(--color-on-primary)"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          ChampaShop
        </NuxtLink>

        <nav class="layout__nav" aria-label="Navigation principale">
          <ul>
            <li><NuxtLink to="/">Accueil</NuxtLink></li>
            <li><NuxtLink to="/produits">Produits</NuxtLink></li>
            <!-- Le prénom reste affiché : rendu côté serveur, il prouve qu'il n'y a pas de flash
                 de l'état déconnecté (vérifié par e2e/connexion.spec.ts). -->
            <template v-if="user">
              <li class="layout__hello">Bonjour, {{ user.firstName }}</li>
              <li><NuxtLink to="/compte">Mon compte</NuxtLink></li>
            </template>
            <li v-else><NuxtLink to="/connexion">Connexion</NuxtLink></li>
          </ul>
        </nav>

        <!-- Le nom accessible (aria-label) contient le texte visible « Panier » (WCAG 2.5.3) ;
             l'icône et la pastille du nombre sont décoratives. -->
        <NuxtLink to="/panier" class="layout__cart" :aria-label="cartLabel">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path
              d="M6 8h12l-1.2 10a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8Z M9 8V7a3 3 0 0 1 6 0v1"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="layout__cart-label" aria-hidden="true">Panier</span>
          <span class="layout__count" aria-hidden="true">{{ cart.itemCount }}</span>
        </NuxtLink>
      </div>
    </header>

    <main id="contenu" class="layout__main">
      <div class="container">
        <slot />
      </div>
    </main>

    <CompareBar />

    <footer class="layout__footer">
      <div class="container layout__footer-grid">
        <div>
          <p class="layout__footer-brand">ChampaShop</p>
          <p>Livraison {{ shipping }}.</p>
        </div>
        <nav aria-label="Pied de page">
          <ul>
            <li><NuxtLink to="/produits">Tous les produits</NuxtLink></li>
            <li><NuxtLink to="/comparer">Comparer</NuxtLink></li>
            <li><NuxtLink to="/panier">Mon panier</NuxtLink></li>
          </ul>
        </nav>
      </div>
      <div class="container layout__footer-legal">
        <p>© ChampaShop, boutique fictive, projet pédagogique.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* --- En-tête ---------------------------------------------------------------------------- */
.layout__header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}
.layout__bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-5);
  align-items: center;
  padding-block: var(--space-3);
}
.layout__brand {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--text-xl);
  font-weight: 800;
  color: var(--color-heading);
  text-decoration: none;
}
.layout__logo {
  color: var(--color-primary);
}
.layout__nav {
  /* Sur mobile, la navigation passe sur sa propre ligne, sous le logo et le panier. */
  flex: 1 1 100%;
  order: 3;
}
.layout__nav ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  align-items: center;
  padding: 0;
  margin: 0;
  list-style: none;
}
.layout__nav a {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-target);
  padding-inline: var(--space-3);
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
  border-radius: var(--radius-pill);
}
.layout__nav a:hover {
  background: var(--color-surface-muted);
}
/* Page courante : fond et couleur, pas seulement la couleur (WCAG 1.4.1). */
.layout__nav a[aria-current='page'] {
  color: var(--color-primary);
  background: var(--color-surface-muted);
}
.layout__hello {
  padding-inline: var(--space-3);
  color: var(--color-text-muted);
}
.layout__cart {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--touch-target);
  padding-inline: var(--space-4);
  margin-left: auto;
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: none;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-pill);
}
.layout__cart:hover {
  color: var(--color-on-primary);
  background: var(--color-primary);
}
.layout__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding-inline: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-on-accent);
  background: var(--color-accent);
  border-radius: var(--radius-pill);
}

/* Écran étroit : icône et pastille seulement, pour que le panier reste à côté du logo. */
@media (max-width: 30rem) {
  .layout__cart-label {
    display: none;
  }
  .layout__cart {
    padding-inline: var(--space-3);
  }
}

@media (min-width: 52rem) {
  .layout__nav {
    flex: 1 1 auto;
    order: 0;
  }
}

/* --- Contenu ---------------------------------------------------------------------------- */
.layout__main {
  flex: 1;
  padding-block: var(--space-6) var(--space-8);
}

/* --- Pied de page ----------------------------------------------------------------------- */
.layout__footer {
  color: var(--color-footer-text);
  background: var(--color-heading);
}
.layout__footer-grid {
  display: grid;
  gap: var(--space-5);
  padding-block: var(--space-6);
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}
.layout__footer p,
.layout__footer ul {
  margin: 0;
}
.layout__footer-brand {
  margin-bottom: var(--space-2);
  font-size: var(--text-xl);
  font-weight: 800;
  color: var(--color-on-primary);
}
.layout__footer ul {
  padding: 0;
  list-style: none;
}
.layout__footer a {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-target);
  color: var(--color-footer-text);
}
.layout__footer a:hover {
  color: var(--color-on-primary);
}
.layout__footer-legal {
  padding-block: var(--space-4);
  font-size: var(--text-sm);
  border-top: 1px solid rgb(255 255 255 / 20%);
}

/* --- Lien d'évitement ------------------------------------------------------------------- */
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  top: var(--space-4);
  left: var(--space-4);
  z-index: 50;
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}
</style>
