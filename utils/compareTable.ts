import type { CompareRow, CompareTableProduct } from '../types/compareTable'
import type { AvailabilityStatus } from '../types/dummyjson'
import { formatCents, toCents } from './price'
import { discountBadge, formatRating } from './product'

/**
 * Index des meilleures valeurs. Plusieurs index en cas d'égalité ; aucun si tous les
 * produits sont à égalité (dire « Meilleur prix » à tout le monde n'aide pas à choisir)
 * ou s'il n'y a qu'un produit.
 */
export function bestIndexes(values: number[], direction: 'min' | 'max'): number[] {
  if (values.length < 2) return []
  const best = direction === 'min' ? Math.min(...values) : Math.max(...values)
  const indexes = values.flatMap((value, index) => (value === best ? [index] : []))
  return indexes.length === values.length ? [] : indexes
}

const AVAILABILITY: Record<AvailabilityStatus, string> = {
  'In Stock': 'En stock',
  'Low Stock': 'Stock faible',
  'Out of Stock': 'Rupture de stock',
}

/** `mens-shirts` → « Mens Shirts », le même format que les noms de `/products/categories`. */
export function categoryLabel(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

/** Largeur × hauteur × profondeur, nombres au format français : « 15,14 × 13,08 × 22,99 ». */
export function formatDimensions(dimensions: CompareTableProduct['dimensions']): string {
  return [dimensions.width, dimensions.height, dimensions.depth]
    .map((value) => numberFormatter.format(value))
    .join(' × ')
}

const UNITS: Record<string, [singular: string, plural: string]> = {
  day: ['jour', 'jours'],
  week: ['semaine', 'semaines'],
  month: ['mois', 'mois'],
  year: ['an', 'ans'],
}

function duration(count: string, unit: string): string | null {
  const names = UNITS[unit]
  return names ? `${count} ${count === '1' ? names[0] : names[1]}` : null
}

/**
 * Garantie en français : « 1 year warranty » → « 1 an ». L'API répond en anglais alors que la
 * page est en `lang="fr"` : un lecteur d'écran prononcerait l'anglais avec un accent français.
 * Format inconnu : texte d'origine, plutôt qu'une traduction fausse.
 */
export function warrantyLabel(text: string): string {
  if (/^lifetime warranty$/i.test(text)) return 'À vie'
  if (/^no warranty$/i.test(text)) return 'Aucune'
  const match = /^(\d+) (day|week|month|year)s? warranty$/i.exec(text.trim())
  return (match && duration(match[1] ?? '', (match[2] ?? '').toLowerCase())) ?? text
}

/** Livraison en français : « Ships in 3-5 business days » → « Expédié sous 3 à 5 jours ouvrés ». */
export function shippingLabel(text: string): string {
  if (/^ships overnight$/i.test(text)) return 'Expédié en 24 h'
  const business = /^ships in (\d+)(?:-(\d+))? business days?$/i.exec(text.trim())
  if (business) {
    const [, from, to] = business
    const days = to || from !== '1' ? 'jours ouvrés' : 'jour ouvré'
    return `Expédié sous ${to ? `${from} à ${to}` : from} ${days}`
  }
  const delay = /^ships in (\d+) (day|week|month)s?$/i.exec(text.trim())
  const label = delay && duration(delay[1] ?? '', (delay[2] ?? '').toLowerCase())
  return label ? `Expédié sous ${label}` : text
}

/** Description d'une ligne : texte de chaque cellule, et valeur à comparer si la ligne l'est. */
interface RowDefinition {
  id: string
  label: string
  text: (product: CompareTableProduct) => string
  compare?: {
    value: (product: CompareTableProduct) => number
    direction: 'min' | 'max'
    bestLabel: string
  }
}

const ROWS: RowDefinition[] = [
  {
    id: 'price',
    label: 'Prix',
    text: (product) => formatCents(toCents(product.price)),
    // Comparé en centimes, comme partout ailleurs (pas d'erreur de virgule flottante).
    compare: {
      value: (product) => toCents(product.price),
      direction: 'min',
      bestLabel: 'Meilleur prix',
    },
  },
  {
    id: 'discount',
    label: 'Remise',
    text: (product) => discountBadge(product.discountPercentage) ?? 'Aucune',
  },
  {
    id: 'rating',
    label: 'Note',
    text: (product) => `${formatRating(product.rating)} sur 5`,
    compare: { value: (product) => product.rating, direction: 'max', bestLabel: 'Meilleure note' },
  },
  {
    id: 'availability',
    label: 'Disponibilité',
    text: (product) => AVAILABILITY[product.availabilityStatus] ?? product.availabilityStatus,
  },
  {
    id: 'stock',
    label: 'Stock',
    text: (product) => `${product.stock} unité${product.stock > 1 ? 's' : ''}`,
    compare: {
      value: (product) => product.stock,
      direction: 'max',
      bestLabel: 'Stock le plus élevé',
    },
  },
  { id: 'brand', label: 'Marque', text: (product) => product.brand ?? 'Non renseignée' },
  { id: 'category', label: 'Catégorie', text: (product) => categoryLabel(product.category) },
  { id: 'weight', label: 'Poids', text: (product) => numberFormatter.format(product.weight) },
  {
    id: 'dimensions',
    label: 'Dimensions (l × h × p)',
    text: (product) => formatDimensions(product.dimensions),
  },
  {
    id: 'warranty',
    label: 'Garantie',
    text: (product) => warrantyLabel(product.warrantyInformation),
  },
  {
    id: 'shipping',
    label: 'Livraison',
    text: (product) => shippingLabel(product.shippingInformation),
  },
]

/**
 * Lignes du tableau comparatif, dans l'ordre d'affichage. L'image et le titre sont dans
 * les en-têtes de colonnes. Fonction pure : le composant ne fait que l'affichage.
 */
export function buildCompareRows(products: CompareTableProduct[]): CompareRow[] {
  return ROWS.map((row) => {
    const cells = products.map(row.text)
    const best = row.compare
      ? bestIndexes(products.map(row.compare.value), row.compare.direction)
      : []
    return {
      id: row.id,
      label: row.label,
      cells,
      best,
      bestLabel: row.compare && best.length > 0 ? row.compare.bestLabel : null,
      same: cells.every((cell) => cell === cells[0]),
    }
  })
}
