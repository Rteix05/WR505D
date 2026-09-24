<script setup lang="ts">
const config = useRuntimeConfig()

useSeoMeta({
  title: 'Accueil',
  description: 'ChampaShop, la boutique en ligne rapide, bien référencée et accessible.',
  ogTitle: 'ChampaShop',
  ogDescription: 'ChampaShop, la boutique en ligne rapide, bien référencée et accessible.',
  ogType: 'website',
  ogUrl: config.public.siteUrl,
})
</script>

<template>
  <section>
    <h1>Bienvenue sur ChampaShop</h1>
    <p>Le catalogue arrive bientôt.</p>
  </section>
</template>
