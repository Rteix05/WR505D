// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxt/eslint', '@nuxt/test-utils/module'],

  typescript: {
    strict: true,
    typeCheck: true,
  },

  runtimeConfig: {
    public: {
      apiBase: 'https://dummyjson.com',
      // Durée de vie de l'accessToken. Surcharge : NUXT_PUBLIC_AUTH_EXPIRES_IN_MINS=1
      authExpiresInMins: 30,
      // Sur Vercel, VERCEL_PROJECT_PRODUCTION_URL est fourni automatiquement (sans protocole)
      siteUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3000',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      titleTemplate: '%s · ChampaShop',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'ChampaShop, la boutique en ligne rapide et accessible.',
        },
        { property: 'og:site_name', content: 'ChampaShop' },
        { property: 'og:locale', content: 'fr_FR' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },

  eslint: {
    config: {
      stylistic: false,
    },
  },
})
