import type { AuthTokens } from '../types/dummyjson'
import { httpStatusOf } from './auth'
import { createSingleFlight } from './singleFlight'

export interface AuthFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number>
  body?: Record<string, unknown>
  headers?: Record<string, string>
}

export type AuthFetch = <T>(url: string, options?: AuthFetchOptions) => Promise<T>

/**
 * Tout ce dont le client a besoin, fourni de l'extérieur (inversion des dépendances) :
 * en production le plugin branche $fetch et les cookies, en test on branche des faux.
 */
export interface AuthFetchDeps {
  request: <T>(url: string, options: AuthFetchOptions) => Promise<T>
  getAccessToken: () => string | null | undefined
  getRefreshToken: () => string | null | undefined
  refreshTokens: (refreshToken: string) => Promise<AuthTokens>
  saveTokens: (tokens: AuthTokens) => void
  onSessionExpired: () => void
}

/** La session ne peut plus être prolongée : l'utilisateur doit se reconnecter. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expirée, veuillez vous reconnecter.')
    this.name = 'SessionExpiredError'
  }
}

function withBearer(options: AuthFetchOptions, token: string): AuthFetchOptions {
  return { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } }
}

/**
 * Client HTTP authentifié. Sur une 401, le jeton est rafraîchi puis la requête rejouée.
 * Si plusieurs requêtes reçoivent une 401 en même temps, un seul POST /auth/refresh part
 * (single-flight) et toutes sont rejouées avec le nouveau jeton.
 */
export function createAuthFetch(deps: AuthFetchDeps): AuthFetch {
  const refreshAccessToken = createSingleFlight(async (): Promise<string> => {
    const refreshToken = deps.getRefreshToken()
    if (!refreshToken) {
      deps.onSessionExpired()
      throw new SessionExpiredError()
    }
    try {
      const tokens = await deps.refreshTokens(refreshToken)
      deps.saveTokens(tokens)
      return tokens.accessToken
    } catch (error) {
      // Pas de réponse (réseau) : la session est peut-être encore valide, on ne la supprime pas.
      if (httpStatusOf(error) === undefined) throw error
      // Réponse d'erreur de l'API : refreshToken invalide ou expiré.
      deps.onSessionExpired()
      throw new SessionExpiredError()
    }
  })

  return async function authFetch<T>(url: string, options: AuthFetchOptions = {}): Promise<T> {
    // Cookie accessToken expiré mais refreshToken présent : on rafraîchit avant d'appeler.
    const usedToken = deps.getAccessToken() || (await refreshAccessToken())

    try {
      return await deps.request<T>(url, withBearer(options, usedToken))
    } catch (error) {
      if (httpStatusOf(error) !== 401) throw error

      // Si le jeton a changé pendant la requête, un autre appel l'a déjà rafraîchi :
      // on rejoue directement, sans relancer un refresh.
      const currentToken = deps.getAccessToken()
      const freshToken =
        currentToken && currentToken !== usedToken ? currentToken : await refreshAccessToken()

      // Un seul rejeu : une deuxième 401 remonte à l'appelant (pas de boucle infinie).
      return deps.request<T>(url, withBearer(options, freshToken))
    }
  }
}
