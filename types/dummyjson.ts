// Réponses de l'API DummyJSON, écrites à partir des réponses réelles (curl, 29/09/2026).
// Seuls les champs utilisés ou utiles sont typés : un champ absent du type n'est jamais lu.

// --- Produits ----------------------------------------------------------------

/** Avis client, inclus dans chaque produit (`product.reviews`). */
export interface Review {
  /** Note entière de 1 à 5. */
  rating: number
  comment: string
  /** Date ISO 8601, ex. `2025-04-30T09:41:02.053Z`. */
  date: string
  reviewerName: string
  reviewerEmail: string
}

export type AvailabilityStatus = 'In Stock' | 'Low Stock' | 'Out of Stock'

/** GET /products/{id}, et chaque élément de `ProductsResponse.products`. */
export interface Product {
  id: number
  title: string
  description: string
  /** Slug de la catégorie, ex. `beauty`. */
  category: string
  /** Prix en euros avec décimales (ex. 9.99) : convertir avec `toCents` avant tout calcul. */
  price: number
  /** Remise en pourcentage avec décimales (ex. 10.48), pour le badge « −X % ». */
  discountPercentage: number
  /** Note moyenne de 0 à 5, avec décimales. */
  rating: number
  stock: number
  tags: string[]
  /** Absent pour environ la moitié des produits (épicerie, déco…). */
  brand?: string
  sku: string
  weight: number
  dimensions: { width: number; height: number; depth: number }
  warrantyInformation: string
  shippingInformation: string
  availabilityStatus: AvailabilityStatus
  reviews: Review[]
  returnPolicy: string
  minimumOrderQuantity: number
  meta: { createdAt: string; updatedAt: string; barcode: string; qrCode: string }
  images: string[]
  thumbnail: string
}

/** GET /products, /products/search et /products/category/{slug}. */
export interface ProductsResponse {
  products: Product[]
  /** Nombre total de résultats, toutes pages confondues. */
  total: number
  skip: number
  limit: number
}

/** Élément de GET /products/categories. */
export interface Category {
  /** Identifiant utilisé dans les URL, ex. `mens-shirts`. */
  slug: string
  /** Libellé affichable, ex. `Mens Shirts`. */
  name: string
  url: string
}

// --- Authentification --------------------------------------------------------

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
export interface User extends DummyUserProfile {
  maidenName: string
  age: number
  phone: string
  birthDate: string
  /** Non utilisé par l'application : `string` pour ne pas casser si l'API ajoute un rôle. */
  role: string
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

// --- Erreurs -----------------------------------------------------------------

/** Réponse d'erreur de l'API, ex. { "message": "Product with id '99999' not found" }. */
export interface ApiErrorBody {
  message: string
}
