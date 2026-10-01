import type { AuthUser, DummyUserProfile } from '../types/dummyjson'

export const ACCESS_TOKEN_COOKIE = 'accessToken'
export const REFRESH_TOKEN_COOKIE = 'refreshToken'

/** Durée de vie du refreshToken chez DummyJSON : 30 jours. */
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export const LOGIN_PATH = '/connexion'

/**
 * Ne garde que les champs utiles à l'affichage. Le reste du profil
 * (dont des données sensibles) ne doit pas finir dans le state Pinia,
 * qui est sérialisé dans le HTML rendu côté serveur.
 */
export function toAuthUser(profile: DummyUserProfile): AuthUser {
  return {
    id: profile.id,
    username: profile.username,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    image: profile.image,
  }
}

/**
 * Valide la cible de redirection après connexion (query `?redirect=`).
 * Seuls les chemins internes sont acceptés : `//site.com` ou `https://…`
 * permettraient de renvoyer l'utilisateur vers un site malveillant (open redirect).
 */
export function safeRedirect(target: unknown, fallback = '/'): string {
  const value = Array.isArray(target) ? target[0] : target
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  // Chemin sans query ni hash, sans slash final, en minuscules (vue-router ignore la casse) :
  // /connexion, /connexion/, /Connexion#x et /connexion?a=b désignent la même page.
  const path = value.split(/[?#]/, 1).join('').replace(/\/+$/, '').toLowerCase()
  if (path === LOGIN_PATH) return fallback
  return value
}

/** Code HTTP d'une erreur $fetch, ou undefined si la requête n'a pas abouti (réseau). */
export function httpStatusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined
  return typeof error.statusCode === 'number' ? error.statusCode : undefined
}

/** Message affiché à l'utilisateur quand la connexion échoue. */
export function loginErrorMessage(error: unknown): string {
  const status = httpStatusOf(error)
  if (status === 400 || status === 401) return 'Identifiant ou mot de passe incorrect.'
  if (status === undefined) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.'
  }
  return 'Le service de connexion est indisponible. Réessayez dans quelques instants.'
}

/** Destination du middleware `auth` : la connexion, avec la page demandée en `?redirect=`. */
export interface LoginRedirectLocation {
  path: string
  query: { redirect: string }
}

/**
 * `target` = `to.fullPath` : query et hash compris, pour revenir exactement au même endroit
 * (ex. `/compte?onglet=commandes`). On passe un objet et non une chaîne : vue-router encode
 * lui-même la query, pas de double encodage ni de `&` qui casserait le paramètre.
 */
export function loginRedirectLocation(target: string): LoginRedirectLocation {
  return { path: LOGIN_PATH, query: { redirect: target } }
}
