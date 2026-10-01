// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    // Persistance des stores (séance 7). Le paquet cité en cours, @pinia-plugin-persistedstate/nuxt,
    // est abandonné : celui-ci est le paquet maintenu, compatible Pinia 3+ et @pinia/nuxt 0.10+.
    'pinia-plugin-persistedstate/nuxt',
    '@nuxt/eslint',
    '@nuxt/test-utils/module',
  ],

  // Stockage par défaut des stores persistés : cookie (lisible au rendu serveur, contrairement
  // à localStorage), donc pas de « saut » entre le HTML du serveur et la page hydratée.
  piniaPluginPersistedstate: {
    storage: 'cookies',
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 365 * 24 * 60 * 60,
    },
  },

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
