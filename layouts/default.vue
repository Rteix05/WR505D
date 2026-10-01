<script setup lang="ts">
import { storeToRefs } from 'pinia'

// storeToRefs garde la réactivité en déstructurant le store (une simple déstructuration la perdrait).
const { user } = storeToRefs(useAuthStore())
const cart = useCartStore()
</script>

<template>
  <div class="layout">
    <a href="#contenu" class="skip-link">Aller au contenu</a>
    <header class="layout__header">
      <NuxtLink to="/" class="layout__brand">ChampaShop</NuxtLink>
      <nav aria-label="Navigation principale">
        <ul class="layout__nav">
          <li><NuxtLink to="/">Accueil</NuxtLink></li>
          <li><NuxtLink to="/produits">Produits</NuxtLink></li>
          <li v-if="user">Bonjour, {{ user.firstName }}</li>
          <li v-else><NuxtLink to="/connexion">Connexion</NuxtLink></li>
        </ul>
      </nav>
      <NuxtLink
        to="/panier"
        class="layout__cart"
        :aria-label="`Panier, ${cart.itemCount} article${cart.itemCount > 1 ? 's' : ''}`"
      >
        Panier ({{ cart.itemCount }})
      </NuxtLink>
    </header>
    <main id="contenu" class="layout__main">
      <slot />
    </main>
    <footer class="layout__footer">
      <p>© ChampaShop, boutique fictive, projet pédagogique.</p>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: system-ui, sans-serif;
}
.layout__header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #ddd;
}
.layout__brand {
  font-weight: 700;
  font-size: 1.25rem;
  text-decoration: none;
  color: inherit;
}
.layout__cart {
  font-weight: 600;
}
.layout__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.layout__main {
  flex: 1;
  padding: 1.5rem;
}
.layout__footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #ddd;
  font-size: 0.875rem;
}
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 1rem;
  top: 1rem;
  padding: 0.5rem 1rem;
  background: #fff;
  z-index: 10;
}
</style>
