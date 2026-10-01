import type { AuthTokens } from '~/types/dummyjson'
import type { AuthFetchOptions } from '~/utils/authFetch'

// Fournit $authFetch, le client HTTP authentifié de l'application.
// Un plugin est exécuté une fois par application : côté serveur, une fois par requête.
// Chaque visiteur a donc son propre client et son propre refresh en cours,
// ce qui ne serait pas le cas avec une variable globale de module.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const cookies = useAuthCookies()
  const userStore = useUserStore()

  const authFetch = createAuthFetch({
    request: <T>(url: string, options: AuthFetchOptions) =>
      $fetch<T>(url, { ...options, baseURL: config.public.apiBase }),
    getAccessToken: () => cookies.accessToken.value,
    getRefreshToken: () => cookies.refreshToken.value,
    refreshTokens: (refreshToken) =>
      $fetch<AuthTokens>('/auth/refresh', {
        baseURL: config.public.apiBase,
        method: 'POST',
        body: { refreshToken, expiresInMins: config.public.authExpiresInMins },
      }),
    saveTokens: cookies.setTokens,
    onSessionExpired: () => {
      cookies.clear()
      userStore.setUser(null)
    },
  })

  return { provide: { authFetch } }
})
