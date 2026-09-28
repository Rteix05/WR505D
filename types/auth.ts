// Réponses de l'authentification DummyJSON, écrites à partir des réponses réelles.
// À regrouper dans types/dummyjson.ts une fois l'issue #1 mergée.

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

/** Champs du profil communs à POST /auth/login et GET /auth/me. */
export interface DummyUserProfile {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  gender: string
  image: string
}

/** POST /auth/login : les jetons et un extrait du profil. */
export interface LoginResponse extends AuthTokens, DummyUserProfile {}

/**
 * GET /auth/me : profil complet. L'API renvoie aussi des données sensibles
 * (mot de passe, carte bancaire, SSN…) volontairement non typées ici :
 * elles ne doivent jamais être lues ni stockées.
 */
export interface MeResponse extends DummyUserProfile {
  maidenName: string
  age: number
  phone: string
  birthDate: string
  role: 'admin' | 'moderator' | 'user'
}

/** Réponse d'erreur de l'API, ex. { "message": "Invalid credentials" }. */
export interface ApiErrorBody {
  message: string
}

/** Ce que l'application garde de l'utilisateur connecté (state Pinia, payload SSR). */
export interface AuthUser {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  image: string
}
