import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import type { AuthUser, LoginCredentials } from '~/types/dummyjson'

// La vraie requête (POST /auth/login) et la navigation sont remplacées : on teste le store,
// pas l'API ni le routeur.
const { requestLogin, navigateToMock } = vi.hoisted(() => ({
  requestLogin: vi.fn<(credentials: LoginCredentials) => Promise<void>>(),
  navigateToMock: vi.fn(),
}))

mockNuxtImport('useAuth', () => () => ({ login: requestLogin }))
mockNuxtImport('navigateTo', () => navigateToMock)

const emily: AuthUser = {
  id: 1,
  username: 'emilys',
  email: 'emily.johnson@x.dummyjson.com',
  firstName: 'Emily',
  lastName: 'Johnson',
  image: 'https://dummyjson.com/icon/emilys/128',
}

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthCookies().clear()
    requestLogin.mockReset()
    navigateToMock.mockReset()
  })

  it('getters : isAuthenticated et user suivent le store utilisateur', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()

    useUserStore().setUser(emily)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user?.firstName).toBe('Emily')
  })

  it('getter token : le jeton du cookie partagé avec le refresh (#12)', () => {
    const auth = useAuthStore()
    expect(auth.token).toBeNull()
    useAuthCookies().setTokens({ accessToken: 'a1', refreshToken: 'r1' })
    expect(auth.token).toBe('a1')
  })

  it('login réussi : requête envoyée et nom d’utilisateur mémorisé', async () => {
    requestLogin.mockResolvedValue()
    const auth = useAuthStore()

    await auth.login({ username: 'emilys', password: 'emilyspass' })

    expect(requestLogin).toHaveBeenCalledWith({ username: 'emilys', password: 'emilyspass' })
    expect(auth.rememberedUsername).toBe('emilys')
  })

  it('login refusé : l’erreur remonte, rien n’est mémorisé', async () => {
    requestLogin.mockRejectedValue({ statusCode: 400 })
    const auth = useAuthStore()

    await expect(auth.login({ username: 'emilys', password: 'faux' })).rejects.toEqual({
      statusCode: 400,
    })
    expect(auth.rememberedUsername).toBe('')
  })

  it('logout : jetons et utilisateur supprimés, retour à l’accueil sans historique', async () => {
    useAuthCookies().setTokens({ accessToken: 'a1', refreshToken: 'r1' })
    useUserStore().setUser(emily)
    const auth = useAuthStore()
    auth.rememberedUsername = 'emilys'

    await auth.logout()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(useAuthCookies().refreshToken.value).toBeNull()
    expect(navigateToMock).toHaveBeenCalledWith('/', { replace: true })
    // Gardé exprès : il pré-remplira la prochaine connexion.
    expect(auth.rememberedUsername).toBe('emilys')
  })

  it('forgetUsername efface le nom mémorisé', () => {
    const auth = useAuthStore()
    auth.rememberedUsername = 'emilys'
    auth.forgetUsername()
    expect(auth.rememberedUsername).toBe('')
  })

  it('persistance : seul le nom d’utilisateur est dans l’état sérialisé du store', () => {
    useAuthCookies().setTokens({ accessToken: 'a1', refreshToken: 'r1' })
    useUserStore().setUser(emily)
    const auth = useAuthStore()
    auth.rememberedUsername = 'emilys'

    // Les getters (user, token, isAuthenticated) ne font pas partie du state : ni les jetons
    // ni le profil ne peuvent être recopiés dans le cookie `auth`.
    expect(auth.$state).toEqual({ rememberedUsername: 'emilys' })
  })
})
