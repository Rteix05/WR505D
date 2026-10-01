<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed((): boolean => props.error.statusCode === 404)
// « Produit introuvable » quand la fiche produit le précise, sinon un titre générique.
const heading = computed((): string => {
  if (!isNotFound.value) return 'Une erreur est survenue'
  return props.error.statusMessage || 'Page introuvable'
})

useSeoMeta({
  title: heading,
  // Une page d'erreur ne doit jamais être indexée.
  robots: 'noindex, nofollow',
})
</script>

<template>
  <!-- Même en-tête et pied de page que le reste du site : l'utilisateur n'est pas perdu. -->
  <NuxtLayout>
    <section class="error" aria-labelledby="error-title">
      <h1 id="error-title">{{ heading }}</h1>
      <p v-if="isNotFound">Ce que vous cherchez n'existe pas ou n'est plus disponible.</p>
      <p v-else>Réessayez dans quelques instants.</p>
      <!-- Liens classiques (rechargement complet) : ils marchent sans JavaScript et repartent
           d'une application sans erreur, sans avoir à appeler clearError(). -->
      <p class="error__links">
        <a href="/produits" class="error__button">Voir tous les produits</a>
        <a href="/">Retour à l'accueil</a>
      </p>
    </section>
  </NuxtLayout>
</template>

<style scoped>
.error {
  max-width: 32rem;
  margin: 2rem auto;
}
.error__links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}
.error__button {
  display: inline-block;
  padding: 0.625rem 1rem;
  font-weight: 600;
  color: #fff;
  background: #1f2937;
  text-decoration: none;
  border-radius: 0.375rem;
}
:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
</style>
