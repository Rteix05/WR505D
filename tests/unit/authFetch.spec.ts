import { describe, expect, it, vi } from 'vitest'
import {
  createAuthFetch,
  SessionExpiredError,
  type AuthFetchDeps,
  type AuthFetchOptions,
} from '../../utils/authFetch'
import type { AuthTokens } from '../../types/auth'

/** Laisse les autres promesses en attente avancer (simule la latence réseau). */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Faux DummyJSON : une requête n'est acceptée qu'avec le jeton actuellement valide,
 * sinon elle échoue en 401 comme $fetch ({ statusCode: 401 }).
 */
function createFakeApi(initial: { access?: string; refresh?: string } = {}) {
  let validToken = 'token-1'
  let generation = 1
  const cookies = {
    access: 'access' in initial ? initial.access : 'token-1',
    refresh: 'refresh' in initial ? initial.refresh : 'refresh-1',
  }
  const gates = new Map<string, Promise<void>>()

  const request = vi.fn(async (url: string, options: AuthFetchOptions): Promise<unknown> => {
    const sentToken = options.headers?.Authorization
    await (gates.get(url) ?? tick())
    if (sentToken !== `Bearer ${validToken}`) throw { statusCode: 401 }
    return { url, token: sentToken }
  })

  const refreshTokens = vi.fn(async (refreshToken: string): Promise<AuthTokens> => {
    await tick()
    if (refreshToken !== `refresh-${generation}`) throw { statusCode: 403 }
    generation += 1
    validToken = `token-${generation}`
    return { accessToken: validToken, refreshToken: `refresh-${generation}` }
  })

  const onSessionExpired = vi.fn(() => {
    cookies.access = undefined
    cookies.refresh = undefined
  })

  const deps: AuthFetchDeps = {
    request: request as AuthFetchDeps['request'],
    getAccessToken: () => cookies.access,
    getRefreshToken: () => cookies.refresh,
    refreshTokens,
    saveTokens: (tokens) => {
      cookies.access = tokens.accessToken
      cookies.refresh = tokens.refreshToken
    },
    onSessionExpired,
  }

  return {
    authFetch: createAuthFetch(deps),
    request,
    refreshTokens,
    onSessionExpired,
    cookies,
    /** Le jeton actuel expire côté API (comme après expiresInMins). */
    expireToken: () => {
      validToken = 'expired'
    },
    /** Retient la réponse d'une URL jusqu'à l'appel de la fonction renvoyée. */
    hold: (url: string): (() => void) => {
      let release = (): void => {}
      gates.set(url, new Promise<void>((resolve) => (release = resolve)))
      return release
    },
    deps,
  }
}

describe('createAuthFetch', () => {
  it('jeton valide : une seule requête, avec le header Bearer, sans refresh', async () => {
    const api = createFakeApi()
    await expect(api.authFetch('/auth/me')).resolves.toEqual({
      url: '/auth/me',
      token: 'Bearer token-1',
    })
    expect(api.request).toHaveBeenCalledTimes(1)
    expect(api.refreshTokens).not.toHaveBeenCalled()
  })

  it('conserve les options et headers de l’appelant', async () => {
    const api = createFakeApi()
    await api.authFetch('/carts/add', {
      method: 'POST',
      body: { id: 1 },
      headers: { 'X-Test': 'oui' },
    })
    expect(api.request).toHaveBeenCalledWith('/carts/add', {
      method: 'POST',
      body: { id: 1 },
      headers: { 'X-Test': 'oui', Authorization: 'Bearer token-1' },
    })
  })

  it('401 simultanées : un seul POST /auth/refresh, toutes les requêtes rejouées', async () => {
    const api = createFakeApi()
    api.expireToken()

    const results = await Promise.all([
      api.authFetch('/auth/me'),
      api.authFetch('/products/1'),
      api.authFetch('/carts/user/1'),
    ])

    expect(api.refreshTokens).toHaveBeenCalledTimes(1)
    expect(results).toEqual([
      { url: '/auth/me', token: 'Bearer token-2' },
      { url: '/products/1', token: 'Bearer token-2' },
      { url: '/carts/user/1', token: 'Bearer token-2' },
    ])
    // 3 requêtes en échec + 3 rejeux
    expect(api.request).toHaveBeenCalledTimes(6)
    expect(api.cookies).toEqual({ access: 'token-2', refresh: 'refresh-2' })
  })

  it('401 reçue après un refresh déjà terminé : rejoue sans second refresh', async () => {
    const api = createFakeApi()
    api.expireToken()
    const releaseSlow = api.hold('/lente')

    // La requête lente part avec token-1…
    const slow = api.authFetch('/lente')
    // …pendant qu'une autre requête échoue, rafraîchit et termine.
    await api.authFetch('/rapide')
    expect(api.refreshTokens).toHaveBeenCalledTimes(1)

    // La requête lente reçoit enfin sa 401 : le jeton a déjà changé, pas de nouveau refresh.
    releaseSlow()
    await expect(slow).resolves.toEqual({ url: '/lente', token: 'Bearer token-2' })
    expect(api.refreshTokens).toHaveBeenCalledTimes(1)
  })

  it('refresh successifs : un nouveau refresh est possible après le premier', async () => {
    const api = createFakeApi()
    api.expireToken()
    await api.authFetch('/auth/me')
    api.expireToken()
    await api.authFetch('/auth/me')
    expect(api.refreshTokens).toHaveBeenCalledTimes(2)
    expect(api.cookies.access).toBe('token-3')
  })

  it('cookie accessToken absent mais refreshToken présent : rafraîchit avant d’appeler', async () => {
    const api = createFakeApi({ access: undefined })
    api.expireToken()
    await expect(api.authFetch('/auth/me')).resolves.toEqual({
      url: '/auth/me',
      token: 'Bearer token-2',
    })
    expect(api.refreshTokens).toHaveBeenCalledTimes(1)
    expect(api.request).toHaveBeenCalledTimes(1)
  })

  it('refreshToken refusé : session expirée une seule fois, toutes les requêtes échouent', async () => {
    const api = createFakeApi({ refresh: 'refresh-inconnu' })
    api.expireToken()

    const results = await Promise.allSettled([
      api.authFetch('/auth/me'),
      api.authFetch('/products/1'),
    ])

    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
    for (const result of results) {
      if (result.status === 'rejected') expect(result.reason).toBeInstanceOf(SessionExpiredError)
    }
    expect(api.refreshTokens).toHaveBeenCalledTimes(1)
    expect(api.onSessionExpired).toHaveBeenCalledTimes(1)
    expect(api.cookies).toEqual({ access: undefined, refresh: undefined })
  })

  it('aucun refreshToken : session expirée sans appel à /auth/refresh', async () => {
    const api = createFakeApi({ refresh: undefined })
    api.expireToken()
    await expect(api.authFetch('/auth/me')).rejects.toBeInstanceOf(SessionExpiredError)
    expect(api.refreshTokens).not.toHaveBeenCalled()
    expect(api.onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('refresh en erreur réseau : l’erreur remonte, la session n’est pas supprimée', async () => {
    const api = createFakeApi()
    api.expireToken()
    const networkError = new TypeError('fetch failed')
    api.refreshTokens.mockRejectedValueOnce(networkError)

    await expect(api.authFetch('/auth/me')).rejects.toBe(networkError)
    expect(api.onSessionExpired).not.toHaveBeenCalled()
    expect(api.cookies.refresh).toBe('refresh-1')
  })

  it('erreur autre que 401 : remonte telle quelle, sans refresh', async () => {
    const api = createFakeApi()
    api.request.mockRejectedValueOnce({ statusCode: 404 })
    await expect(api.authFetch('/products/9999')).rejects.toEqual({ statusCode: 404 })
    expect(api.refreshTokens).not.toHaveBeenCalled()
  })

  it('401 encore après le rejeu : l’erreur remonte, pas de boucle infinie', async () => {
    const api = createFakeApi()
    api.request.mockRejectedValue({ statusCode: 401 })
    await expect(api.authFetch('/auth/me')).rejects.toEqual({ statusCode: 401 })
    expect(api.refreshTokens).toHaveBeenCalledTimes(1)
    expect(api.request).toHaveBeenCalledTimes(2)
  })
})
