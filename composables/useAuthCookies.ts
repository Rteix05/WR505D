import type { Ref } from 'vue'
import type { NuxtApp } from '#app'
import type { AuthTokens } from '~/types/dummyjson'

export interface AuthCookies {
  accessToken: Ref<string | null | undefined>
  refreshToken: Ref<string | null | undefined>
  setTokens: (tokens: AuthTokens) => void
  clear: () => void
}

// Une seule instance par application Nuxt. Deux appels à useCookie('accessToken')
// donnent deux refs distinctes, non synchronisées côté serveur et synchronisées
// de façon asynchrone côté client : après un refresh, l'une garderait l'ancien jeton.
// Clé = nuxtApp : côté serveur, chaque requête (donc chaque visiteur) a la sienne.
const instances = new WeakMap<NuxtApp, AuthCookies>()

export function useAuthCookies(): AuthCookies {
  const nuxtApp = useNuxtApp()
  const existing = instances.get(nuxtApp)
  if (existing) return existing

  const config = useRuntimeConfig()
  const options = { path: '/', sameSite: 'lax', secure: !import.meta.dev } as const

  // Le cookie expire en même temps que le jeton : on n'envoie jamais un jeton déjà périmé.
  const accessToken = useCookie<string | null>(ACCESS_TOKEN_COOKIE, {
    ...options,
    maxAge: config.public.authExpiresInMins * 60,
  })
  const refreshToken = useCookie<string | null>(REFRESH_TOKEN_COOKIE, {
    ...options,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  })

  const cookies: AuthCookies = {
    accessToken,
    refreshToken,
    setTokens(tokens) {
      accessToken.value = tokens.accessToken
      refreshToken.value = tokens.refreshToken
    },
    clear() {
      accessToken.value = null
      refreshToken.value = null
    },
  }
  instances.set(nuxtApp, cookies)
  return cookies
}
