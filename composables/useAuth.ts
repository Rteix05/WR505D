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
  const expiresInMins = config.public.authExpiresInMins

  const cookieOptions = { path: '/', sameSite: 'lax', secure: !import.meta.dev } as const
  // Le cookie expire en même temps que le jeton : on n'envoie jamais un jeton déjà périmé.
  const accessToken = useCookie<string | null>(ACCESS_TOKEN_COOKIE, {
    ...cookieOptions,
    maxAge: expiresInMins * 60,
  })
  const refreshToken = useCookie<string | null>(REFRESH_TOKEN_COOKIE, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  })

  /** POST /auth/login : stocke les jetons en cookies et l'utilisateur dans le store. */
  async function login(credentials: LoginCredentials): Promise<void> {
    const response = await $fetch<LoginResponse>('/auth/login', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: { ...credentials, expiresInMins },
    })
    accessToken.value = response.accessToken
    refreshToken.value = response.refreshToken
    store.setUser(toAuthUser(response))
  }

  /** GET /auth/me avec le jeton du cookie. Appelé côté serveur par le plugin auth. */
  async function loadUser(): Promise<void> {
    if (!accessToken.value) {
      store.setUser(null)
      return
    }
    try {
      const me = await $fetch<MeResponse>('/auth/me', {
        baseURL: config.public.apiBase,
        headers: { Authorization: `Bearer ${accessToken.value}` },
      })
      store.setUser(toAuthUser(me))
    } catch {
      // Jeton invalide ou expiré : l'utilisateur est considéré comme déconnecté.
      // Le rafraîchissement automatique du jeton est traité dans l'issue #12.
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
