import type { CartAddBody, CheckoutErrors, CheckoutField, CheckoutForm } from '../types/checkout'
import type { CartItem } from '../types/cart'
import type { AuthUser } from '../types/dummyjson'
import { httpStatusOf } from './auth'

/** Ordre d'affichage des champs du formulaire (aussi utilisé pour placer le focus). */
export const CHECKOUT_FIELDS: readonly CheckoutField[] = [
  'fullName',
  'email',
  'address',
  'postalCode',
  'city',
]

/** Limite de saisie de fullName, address et city ; email a sa propre limite (RFC 5321). */
export const CHECKOUT_MAX_LENGTH = 100
export const EMAIL_MAX_LENGTH = 254

/** `nom@domaine.tld` : au moins un `@` et un point après, sans espace. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Code postal français : 5 chiffres, zéro espace (normalisé avant test). */
const POSTAL_CODE_PATTERN = /^\d{5}$/

function emptyForm(): CheckoutForm {
  return { fullName: '', email: '', address: '', postalCode: '', city: '' }
}

/** Champs textuels : trim + espaces multiples réduits à un seul. */
function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * Nettoie la saisie avant validation et envoi : le trim évite les erreurs
 * « vide » dues à un espace collé, le code postal perd ses espaces (`10 000`
 * → `10000`) car l'API attend 5 chiffres.
 */
export function normalizeCheckoutForm(form: CheckoutForm): CheckoutForm {
  return {
    fullName: collapseSpaces(form.fullName),
    email: collapseSpaces(form.email),
    address: collapseSpaces(form.address),
    postalCode: form.postalCode.replace(/\s+/g, ''),
    city: collapseSpaces(form.city),
  }
}

/**
 * Valide la version normalisée du formulaire. Seuls les champs en erreur sont
 * renvoyés (formulaire valide → `{}`), dans l'ordre de CHECKOUT_FIELDS.
 * Ordre par champ : vide, puis longueur, puis format.
 */
export function validateCheckout(form: CheckoutForm): CheckoutErrors {
  const values = normalizeCheckoutForm(form)
  const errors: CheckoutErrors = {}

  if (values.fullName === '') {
    errors.fullName = 'Saisissez votre nom et prénom.'
  } else if (values.fullName.length > CHECKOUT_MAX_LENGTH) {
    errors.fullName = `Ce champ ne doit pas dépasser ${CHECKOUT_MAX_LENGTH} caractères.`
  }

  if (values.email === '') {
    errors.email = 'Saisissez votre adresse e-mail.'
  } else if (values.email.length > EMAIL_MAX_LENGTH) {
    errors.email = `Ce champ ne doit pas dépasser ${EMAIL_MAX_LENGTH} caractères.`
  } else if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = 'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.'
  }

  if (values.address === '') {
    errors.address = 'Saisissez votre adresse.'
  } else if (values.address.length > CHECKOUT_MAX_LENGTH) {
    errors.address = `Ce champ ne doit pas dépasser ${CHECKOUT_MAX_LENGTH} caractères.`
  }

  if (values.postalCode === '') {
    errors.postalCode = 'Saisissez votre code postal.'
  } else if (!POSTAL_CODE_PATTERN.test(values.postalCode)) {
    errors.postalCode = 'Le code postal doit comporter 5 chiffres, par exemple 10000.'
  }

  if (values.city === '') {
    errors.city = 'Saisissez votre ville.'
  } else if (values.city.length > CHECKOUT_MAX_LENGTH) {
    errors.city = `Ce champ ne doit pas dépasser ${CHECKOUT_MAX_LENGTH} caractères.`
  }

  return errors
}

/** Premier champ en erreur dans l'ordre d'affichage, pour y placer le focus ; `null` si tout est valide. */
export function firstInvalidField(errors: CheckoutErrors): CheckoutField | null {
  return CHECKOUT_FIELDS.find((field) => errors[field] !== undefined) ?? null
}

/** Préremplit le formulaire depuis l'utilisateur connecté ; déconnecté → formulaire vide. */
export function prefillCheckout(
  user: Pick<AuthUser, 'firstName' | 'lastName' | 'email'> | null,
): CheckoutForm {
  if (user === null) return emptyForm()
  return {
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    address: '',
    postalCode: '',
    city: '',
  }
}

/** Lignes du panier → corps JSON de POST /carts/add (DummyJSON attend `id`, pas `productId`). */
export function toCartAddBody(userId: number, items: readonly CartItem[]): CartAddBody {
  return {
    userId,
    products: items.map((item) => ({ id: item.productId, quantity: item.quantity })),
  }
}

/**
 * Lit le `?numero=` de l'URL de confirmation de commande. `unknown` : la query
 * vient du navigateur (tableau si le paramètre est répété, tout le reste rejeté).
 * Une valeur invalide donne `null`, jamais une erreur. 10 chiffres au plus : le
 * nombre reste toujours un entier exact (bien sous `Number.MAX_SAFE_INTEGER`).
 */
export function parseOrderNumber(value: unknown): number | null {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first !== 'string' || !/^[1-9]\d{0,9}$/.test(first)) return null
  return Number(first)
}

/**
 * Message de l'échec de POST /carts/add. La session expirée est traitée avant (retour à
 * la connexion) ; ici, toujours rappeler que le panier est gardé : rien n'est perdu.
 */
export function orderErrorMessage(error: unknown): string {
  if (httpStatusOf(error) === undefined) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion : votre panier est conservé.'
  }
  return 'Le paiement est indisponible pour le moment. Votre panier est conservé, réessayez dans quelques instants.'
}
