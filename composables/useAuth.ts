import type { ComputedRef } from 'vue'
import type { AuthUser, LoginCredentials, LoginResponse, MeResponse } from '~/types/auth'

export interface UseAuth {
  user: ComputedRef<AuthUser | null>
  isLoggedIn: ComputedRef<boolean>
  login: (credentials: LoginCredentials) => Promise<void>
  loadUser: () => Promise<void>
}

export function useAuth(): UseAuth {
  const config = useRuntimeConfig()
  const store = useUserStore()
  const cookies = useAuthCookies()
  const { $authFetch } = useNuxtApp()

  /** POST /auth/login : stocke les jetons en cookies et l'utilisateur dans le store. */
  async function login(credentials: LoginCredentials): Promise<void> {
    const response = await $fetch<LoginResponse>('/auth/login', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: { ...credentials, expiresInMins: config.public.authExpiresInMins },
    })
    cookies.setTokens(response)
    store.setUser(toAuthUser(response))
  }

  /**
   * GET /auth/me via le client authentifié : si le jeton a expiré, il est rafraîchi
   * automatiquement. Appelé côté serveur par le plugin auth.
   */
  async function loadUser(): Promise<void> {
    if (!cookies.accessToken.value && !cookies.refreshToken.value) {
      store.setUser(null)
      return
    }
    try {
      const me = await $authFetch<MeResponse>('/auth/me')
      store.setUser(toAuthUser(me))
    } catch {
      // Session expirée (cookies déjà vidés par $authFetch) ou API injoignable.
      store.setUser(null)
    }
  }

  return {
    user: computed(() => store.user),
    isLoggedIn: computed(() => store.isLoggedIn),
    login,
    loadUser,
  }
}
