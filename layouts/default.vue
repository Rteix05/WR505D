<template>
  <div class="layout">
    <a href="#contenu" class="skip-link">Aller au contenu</a>
    <header class="layout__header">
      <NuxtLink to="/" class="layout__brand">ChampaShop</NuxtLink>
      <nav aria-label="Navigation principale">
        <ul class="layout__nav">
          <li><NuxtLink to="/">Accueil</NuxtLink></li>
        </ul>
      </nav>
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
.layout__nav {
  display: flex;
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
