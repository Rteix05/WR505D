<script setup lang="ts">
const route = useRoute()

/** Numéro absent ou invalide : vraie 404, comme une fiche produit inexistante. */
function notFound(): never {
  throw createError({
    statusCode: 404,
    statusMessage: 'Order not found',
    data: { title: 'Commande introuvable' },
    fatal: true,
  })
}

// Le numéro vient de l'URL : la page reste affichée après un rechargement. La commande étant
// simulée (DummyJSON n'enregistre rien et répond toujours 209), il n'y a rien à relire ni à protéger.
const orderNumber = parseOrderNumber(route.query.numero) ?? notFound()

useSeoMeta({
  title: `Commande n° ${orderNumber} simulée`,
  description: 'Confirmation de votre commande ChampaShop (paiement simulé).',
  robots: 'noindex, nofollow',
})
</script>

<template>
  <section class="confirmation" aria-labelledby="confirmation-title">
    <h1 id="confirmation-title">Merci pour votre commande</h1>
    <p class="confirmation__number">
      Commande n° <strong>{{ orderNumber }}</strong> simulée.
    </p>
    <p>
      Rien n'a été débité ni enregistré : DummyJSON simule la commande et renvoie toujours le même
      numéro. Votre panier a été vidé.
    </p>
    <NuxtLink to="/produits">Continuer mes achats</NuxtLink>
  </section>
</template>

<style scoped>
.confirmation__number {
  font-size: 1.125rem;
}
</style>
