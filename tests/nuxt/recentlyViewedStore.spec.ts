import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import type { RecentlyViewedSummary } from '~/types/recentlyViewed'

// Le cookie du store est `secure` : un navigateur de test en http ne le renvoie pas. On le
// remplace par un stockage en mémoire, qui joue le rôle du navigateur entre deux « visites »
// et garde les options reçues pour les vérifier (même méthode que compareStore.spec.ts).
const { jar } = vi.hoisted(() => ({
  jar: new Map<string, { value: unknown; options: Record<string, unknown> }>(),
}))

mockNuxtImport('useCookie', () => (name: string, options: Record<string, unknown> = {}) => {
  let cookie = jar.get(name)
  if (!cookie) {
    cookie = { value: undefined, options }
    jar.set(name, cookie)
  }
  return cookie
})

function summary(id: number): RecentlyViewedSummary {
  return {
    id,
    title: `Produit ${id}`,
    price: 9.99,
    rating: 4.5,
    discountPercentage: 5,
    thumbnail: `https://cdn/${id}.webp`,
  }
}

function cookieValue(): unknown {
  return jar.get(RECENTLY_VIEWED_COOKIE)?.value
}

function setCookie(value: unknown): void {
  jar.set(RECENTLY_VIEWED_COOKIE, { value, options: {} })
}

function freshStore(): ReturnType<typeof useRecentlyViewedStore> {
  setActivePinia(createPinia())
  return useRecentlyViewedStore()
}

describe('useRecentlyViewedStore', () => {
  beforeEach(() => {
    jar.clear()
  })

  it('départ : vide, aucun cookie écrit', () => {
    const store = freshStore()
    expect(store.ids).toEqual([])
    expect(cookieValue()).toBeUndefined()
  })

  it('visites : le plus récent en tête, cookie en identifiants uniquement', () => {
    const store = freshStore()
    store.visit(summary(1))
    store.visit(summary(2))
    store.visit(summary(3))

    expect(store.ids).toEqual([3, 2, 1])
    expect(cookieValue()).toBe('3,2,1')
  })

  it('revisite : le produit remonte en tête, sans doublon', () => {
    const store = freshStore()
    ;[1, 2, 3].forEach((id) => store.visit(summary(id)))
    store.visit(summary(1))

    expect(store.ids).toEqual([1, 3, 2])
    expect(cookieValue()).toBe('1,3,2')
  })

  it('même produit deux fois de suite : rien n’est réécrit', () => {
    const store = freshStore()
    store.visit(summary(1))
    jar.get(RECENTLY_VIEWED_COOKIE)!.value = 'sentinelle'
    store.visit(summary(1))
    expect(cookieValue()).toBe('sentinelle')
  })

  it('10 maximum : au 11ᵉ produit, le plus ancien sort', () => {
    const store = freshStore()
    for (let id = 1; id <= 11; id++) store.visit(summary(id))

    expect(store.ids).toHaveLength(RECENTLY_VIEWED_MAX)
    expect(store.ids[0]).toBe(11)
    expect(store.ids).not.toContain(1)
    expect(String(cookieValue()).split(',')).toHaveLength(RECENTLY_VIEWED_MAX)
  })

  it('cookie : sameSite lax, 30 jours, pour tout le site', () => {
    freshStore().visit(summary(1))
    expect(jar.get(RECENTLY_VIEWED_COOKIE)?.options).toMatchObject({
      path: '/',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    })
  })

  it('persistance : une nouvelle visite du site relit l’historique du cookie', () => {
    const first = freshStore()
    first.visit(summary(1))
    first.visit(summary(2))

    expect(freshStore().ids).toEqual([2, 1])
  })

  it('un seul produit : useCookie le relit comme un nombre', () => {
    setCookie(7)
    expect(freshStore().ids).toEqual([7])
    // Déjà canonique : pas réécrit.
    expect(cookieValue()).toBe(7)
  })

  it('titres et prix : en mémoire seulement, jamais dans le cookie', () => {
    const store = freshStore()
    store.visit(summary(1))
    expect(store.known[1]).toEqual(summary(1))
    expect(JSON.stringify(cookieValue())).not.toContain('Produit')
    expect(JSON.stringify(cookieValue())).not.toContain('cdn')
  })

  // Même leçon que le comparateur (review de #62) : Pinia ne transmet au navigateur que les
  // refs RENVOYÉES. Sans `known`, le serveur affichait les cartes, le navigateur n'en avait aucune.
  it('known fait partie de l’état transmis du serveur au navigateur', () => {
    const store = freshStore()
    store.visit(summary(1))
    expect(Object.keys(store.$state).sort()).toEqual(['ids', 'known'])
    expect(store.$state.known[1]).toEqual(summary(1))
  })

  it('un produit visité est connu : rien à recharger pour lui', () => {
    const store = freshStore()
    store.visit(summary(1))
    expect(store.unknownIds).toEqual([])
  })

  it('après un rechargement : identifiants sans produit, puis rechargés', () => {
    setCookie('3,2,1')
    const store = freshStore()
    expect(store.unknownIds).toEqual([3, 2, 1])

    store.remember([summary(3), summary(1)])
    expect(store.unknownIds).toEqual([2])
  })

  it('produit inconnu de l’API (404) : retiré, cookie réécrit', () => {
    setCookie('1,9999,2')
    const store = freshStore()
    store.drop([9999])

    expect(store.ids).toEqual([1, 2])
    expect(cookieValue()).toBe('1,2')
  })

  it('effacer : historique vidé et cookie supprimé, pas laissé vide', () => {
    const store = freshStore()
    store.visit(summary(1))
    store.clear()

    expect(store.ids).toEqual([])
    expect(cookieValue()).toBeNull()
  })

  describe('cookie corrompu ou modifié à la main : ignoré et réinitialisé', () => {
    it.each([
      ['texte illisible', 'abc', null],
      ['JSON invalide', '[1,', null],
      ['identifiants invalides mélangés', 'abc,,-5,2,2,9', '2,9'],
      ['doublons', '5,5,5', '5'],
      ['plus de 10 identifiants', '1,2,3,4,5,6,7,8,9,10,11,12', '1,2,3,4,5,6,7,8,9,10'],
      ['tableau JSON', [1, 2], '1,2'],
      ['objet', { a: 1 }, null],
    ])('%s', (_label, raw, rewritten) => {
      setCookie(raw)
      const store = freshStore() // ne lève jamais d'erreur

      expect(store.ids).toEqual(rewritten === null ? [] : rewritten.split(',').map(Number))
      // Réécrit proprement dès la lecture : plus de valeur corrompue renvoyée à chaque visite.
      expect(cookieValue()).toBe(rewritten)
    })

    it('cookie sain : pas réécrit', () => {
      setCookie('3,2,1')
      freshStore()
      expect(cookieValue()).toBe('3,2,1')
    })
  })
})
