import { defineStore } from 'pinia'
import type { CompareSummary } from '~/types/compare'

const COMPARE_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export const useCompareStore = defineStore('compare', () => {
  // Le cookie est lu pendant le rendu serveur : la sélection est déjà dans le HTML (bouton
  // `aria-pressed`, barre), sans saut à l'hydratation. Une seule ref pour tout le store :
  // deux `useCookie('compare')` se désynchroniseraient (voir `useAuthCookies`).
  // `unknown` car il vient du navigateur : parseCompareIds le valide, un cookie corrompu est ignoré.
  const cookie = useCookie<unknown>(COMPARE_COOKIE, {
    path: '/',
    sameSite: 'lax',
    secure: !import.meta.dev,
    maxAge: COMPARE_COOKIE_MAX_AGE_SECONDS,
  })

  const ids = ref<number[]>(parseCompareIds(cookie.value))
  // Titre et miniature : jamais dans le cookie (identifiants uniquement). Mais `known` est
  // RENVOYÉ par le store : Pinia ne transmet au navigateur que les refs renvoyées. Sinon le
  // serveur affiche les titres, le navigateur n'en connaît aucun, refait les appels et
  // affiche « Produit n° 3 » (review de #62). Pas persisté : il passe seulement du serveur au navigateur.
  const known = ref<Record<number, CompareSummary>>({})
  /** Dernière phrase à annoncer (`aria-live`), lue par la barre. */
  const announcement = ref('')

  const count = computed((): number => ids.value.length)
  const isFull = computed((): boolean => ids.value.length >= COMPARE_MAX)
  const items = computed((): CompareSummary[] =>
    ids.value.map((id) => known.value[id] ?? { id, title: `Produit n° ${id}`, thumbnail: '' }),
  )

  /** Identifiants dont on ne connaît pas encore le titre (après un rechargement de la page). */
  const unknownIds = computed((): number[] => ids.value.filter((id) => !known.value[id]))

  function persist(): void {
    // `null` supprime le cookie : pas de cookie vide à renvoyer à chaque requête.
    cookie.value = formatCompareIds(ids.value)
  }

  function has(id: number): boolean {
    return ids.value.includes(id)
  }

  /** Ajoute ou retire le produit, et prépare la phrase à annoncer. Comparateur plein : refus. */
  function toggle(product: CompareSummary): void {
    const wasSelected = has(product.id)
    const result = toggleCompare(ids.value, product.id)
    ids.value = result.ids
    if (!result.rejected) {
      known.value[product.id] = product
      persist()
    }
    announcement.value = compareToggleMessage(
      product.title,
      { added: !wasSelected, rejected: result.rejected },
      ids.value.length,
    )
  }

  function remove(id: number): void {
    const title = items.value.find((item) => item.id === id)?.title ?? `Produit n° ${id}`
    ids.value = ids.value.filter((current) => current !== id)
    persist()
    announcement.value = compareToggleMessage(
      title,
      { added: false, rejected: false },
      ids.value.length,
    )
  }

  /** Mémorise titre et miniature chargés depuis l'API (après un rechargement de la page). */
  function remember(products: CompareSummary[]): void {
    for (const product of products) known.value[product.id] = product
  }

  /** Retire sans annoncer les produits que l'API ne connaît pas (cookie ancien ou modifié). */
  function drop(unknownIds: number[]): void {
    if (unknownIds.length === 0) return
    ids.value = ids.value.filter((id) => !unknownIds.includes(id))
    persist()
  }

  function clear(): void {
    ids.value = []
    persist()
  }

  return {
    ids,
    known,
    announcement,
    count,
    isFull,
    items,
    unknownIds,
    has,
    toggle,
    remove,
    remember,
    drop,
    clear,
  }
})
