import { defineStore } from 'pinia'
import type { AuthUser, LoginCredentials } from '~/types/dummyjson'

/**
 * Store d'authentification (séance 7) : un seul point d'entrée pour les composants,
 * en setup syntax : state (`ref`), getters (`computed`), actions (fonctions).
 *
 * Il réutilise les briques existantes au lieu de les dupliquer :
 * - l'utilisateur vient de `useUserStore` (chargé côté serveur par le plugin auth, #10) ;
 * - les jetons viennent de `useAuthCookies` (une seule ref par cookie, partagée avec le
 *   refresh single-flight de #12) ;
 * - la requête de connexion est celle de `useAuth().login`.
 * Seul son propre state, le nom d'utilisateur mémorisé, est persisté par le plugin.
 */
export const useAuthStore = defineStore(
  'auth',
  () => {
    const userStore = useUserStore()
    const cookies = useAuthCookies()
    const { login: requestLogin } = useAuth()

    // --- State ----------------------------------------------------------------
    /** Nom d'utilisateur de la dernière connexion réussie, pour pré-remplir /connexion. */
    const rememberedUsername = ref('')

    // --- Getters --------------------------------------------------------------
    const user = computed((): AuthUser | null => userStore.user)
    const token = computed((): string | null => cookies.accessToken.value ?? null)
    const isAuthenticated = computed((): boolean => userStore.isLoggedIn)

    // --- Actions --------------------------------------------------------------
    /** Connexion ; le nom d'utilisateur n'est mémorisé qu'après une connexion réussie. */
    async function login(credentials: LoginCredentials): Promise<void> {
      await requestLogin(credentials)
      rememberedUsername.value = credentials.username
    }

    /**
     * Déconnexion, la seule de l'application (/compte, #34) : jetons et utilisateur supprimés,
     * retour à l'accueil. DummyJSON n'a pas de route de révocation : sans cookie, plus aucun
     * appel authentifié n'est possible. `replace` : « Précédent » ne ramène pas sur une page privée.
     * Le nom d'utilisateur mémorisé est gardé, pour pré-remplir la prochaine connexion.
     */
    async function logout(): Promise<void> {
      cookies.clear()
      userStore.setUser(null)
      await navigateTo('/', { replace: true })
    }

    function forgetUsername(): void {
      rememberedUsername.value = ''
    }

    return { rememberedUsername, user, token, isAuthenticated, login, logout, forgetUsername }
  },
  {
    // Seul le nom d'utilisateur est écrit dans le cookie `auth` : ni l'utilisateur (données
    // rechargées par /auth/me) ni les jetons (déjà dans leurs propres cookies) ne sont dupliqués.
    persist: { pick: ['rememberedUsername'] },
  },
)
