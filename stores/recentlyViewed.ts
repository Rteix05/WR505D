import { defineStore } from 'pinia'
import type { RecentlyViewedSummary } from '~/types/recentlyViewed'

export const useRecentlyViewedStore = defineStore('recentlyViewed', () => {
  // Une seule ref pour tout le store (comme `compare` et `useAuthCookies`) : deux
  // `useCookie('recently_viewed')` se désynchroniseraient. Lu au rendu serveur : la liste est
  // déjà dans le HTML. `unknown` car il vient du navigateur : parseRecentlyViewedCookie le valide.
  const cookie = useCookie<unknown>(RECENTLY_VIEWED_COOKIE, {
    path: '/',
    sameSite: 'lax',
    secure: !import.meta.dev,
    maxAge: RECENTLY_VIEWED_MAX_AGE_SECONDS,
  })
  const raw = cookie.value
  const ids = ref<number[]>(parseRecentlyViewedCookie(raw))

  // Titre, prix, miniature… : jamais dans le cookie (identifiants uniquement). RENVOYÉ par le
  // store, sinon Pinia ne le transmet pas au navigateur, qui n'en connaîtrait aucun et
  // refait les appels du serveur (même leçon que le comparateur, review de #62).
  const known = ref<Record<number, RecentlyViewedSummary>>({})

  /** Identifiants dont on ne connaît pas encore le produit (après un rechargement de la page). */
  const unknownIds = computed((): number[] => ids.value.filter((id) => !known.value[id]))

  function persist(): void {
    // Vide : le cookie est supprimé (`null`), pas renvoyé vide à chaque requête.
    cookie.value = ids.value.length > 0 ? serializeRecentlyViewed(ids.value) : null
  }

  // Cookie corrompu ou modifié à la main : ignoré par le parseur, puis réécrit proprement.
  if (!isCanonicalRecentlyViewed(raw, ids.value)) persist()

  /**
   * Visite d'une fiche produit existante : en tête de l'historique. Le produit est gardé en
   * mémoire : en revenant à l'accueil, il n'y a rien à recharger pour lui.
   */
  function visit(product: RecentlyViewedSummary): void {
    known.value[product.id] = product
    const next = pushRecentlyViewed(ids.value, product.id)
    if (next.join(',') === ids.value.join(',')) return // déjà en tête : rien à réécrire
    ids.value = next
    persist()
  }

  /** Mémorise les produits chargés depuis l'API (après un rechargement de la page). */
  function remember(products: RecentlyViewedSummary[]): void {
    for (const product of products) known.value[product.id] = product
  }

  /** Retire les identifiants que l'API ne connaît pas (404) : produit supprimé ou cookie trafiqué. */
  function drop(missingIds: number[]): void {
    if (missingIds.length === 0) return
    ids.value = ids.value.filter((id) => !missingIds.includes(id))
    persist()
  }

  function clear(): void {
    ids.value = []
    persist()
  }

  return { ids, known, unknownIds, visit, remember, drop, clear }
})
