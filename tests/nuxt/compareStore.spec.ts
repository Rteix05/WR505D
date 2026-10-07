import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import type { CompareSummary } from '~/types/compare'

// Le cookie du store est `secure` : un navigateur de test en http ne le renvoie pas. On le
// remplace par un stockage en mémoire, qui joue le rôle du navigateur entre deux « visites »
// et garde les options reçues pour les vérifier.
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

const mascara: CompareSummary = { id: 1, title: 'Mascara', thumbnail: 'https://cdn/1.webp' }
const powder: CompareSummary = { id: 2, title: 'Powder', thumbnail: 'https://cdn/2.webp' }
const eyeshadow: CompareSummary = { id: 3, title: 'Eyeshadow', thumbnail: 'https://cdn/3.webp' }
const lipstick: CompareSummary = { id: 4, title: 'Lipstick', thumbnail: 'https://cdn/4.webp' }

/** Valeur brute du cookie `compare`, telle que la verrait le navigateur. */
function cookieValue(): unknown {
  return jar.get(COMPARE_COOKIE)?.value
}

/** Simule un cookie déjà présent (ancien, ou modifié à la main) avant la visite. */
function setCookie(value: unknown): void {
  jar.set(COMPARE_COOKIE, { value, options: {} })
}

function freshStore(): ReturnType<typeof useCompareStore> {
  setActivePinia(createPinia())
  return useCompareStore()
}

describe('useCompareStore', () => {
  beforeEach(() => {
    jar.clear()
  })

  it('départ : vide, rien d’annoncé', () => {
    const compare = freshStore()
    expect(compare.ids).toEqual([])
    expect(compare.count).toBe(0)
    expect(compare.isFull).toBe(false)
    expect(compare.announcement).toBe('')
  })

  it('ajout : identifiant gardé, annoncé avec le compteur, cookie en identifiants uniquement', () => {
    const compare = freshStore()
    compare.toggle(mascara)
    compare.toggle(powder)

    expect(compare.ids).toEqual([1, 2])
    expect(compare.has(1)).toBe(true)
    expect(compare.announcement).toBe('« Powder » ajouté au comparateur (2/3).')
    // Ni titre ni image dans le cookie : identifiants uniquement (consigne du sujet).
    expect(cookieValue()).toBe('1,2')
  })

  it('même bouton une seconde fois : le produit est retiré', () => {
    const compare = freshStore()
    compare.toggle(mascara)
    compare.toggle(mascara)

    expect(compare.ids).toEqual([])
    expect(compare.announcement).toBe('« Mascara » retiré du comparateur (0/3).')
  })

  it('4ᵉ produit : rien n’est ajouté, le message imposé est annoncé, le cookie ne change pas', () => {
    const compare = freshStore()
    ;[mascara, powder, eyeshadow].forEach((product) => compare.toggle(product))
    expect(compare.isFull).toBe(true)

    compare.toggle(lipstick)

    expect(compare.ids).toEqual([1, 2, 3])
    expect(compare.has(4)).toBe(false)
    expect(compare.announcement).toBe(
      'Comparateur plein : retirez un produit pour en ajouter un autre',
    )
    expect(cookieValue()).toBe('1,2,3')
  })

  it('comparateur plein : retirer reste possible, puis un autre peut entrer', () => {
    const compare = freshStore()
    ;[mascara, powder, eyeshadow].forEach((product) => compare.toggle(product))

    compare.remove(2)
    expect(compare.ids).toEqual([1, 3])
    expect(compare.announcement).toBe('« Powder » retiré du comparateur (2/3).')

    compare.toggle(lipstick)
    expect(compare.ids).toEqual([1, 3, 4])
  })

  it('dernier produit retiré : le cookie est supprimé, pas laissé vide', () => {
    const compare = freshStore()
    compare.toggle(mascara)
    compare.remove(1)
    expect(cookieValue()).toBeFalsy()
  })

  it('persistance : une nouvelle visite relit la sélection du cookie (rendu serveur)', () => {
    freshStore().toggle(mascara)
    const reloaded = freshStore()
    expect(reloaded.ids).toEqual([1])
    expect(reloaded.has(1)).toBe(true)
  })

  it('cookie corrompu ou modifié à la main : ignoré, jamais d’erreur', () => {
    setCookie('abc,,-5,1.5,2,2,9,8,7')
    // Valides gardés dans l'ordre, doublons et invalides retirés, 3 au plus.
    expect(freshStore().ids).toEqual([2, 9, 8])

    setCookie('[1,')
    expect(freshStore().ids).toEqual([])
  })

  it('cookie : sameSite lax, 30 jours, pour tout le site', () => {
    freshStore().toggle(mascara)
    expect(jar.get(COMPARE_COOKIE)?.options).toMatchObject({
      path: '/',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    })
  })

  it('un identifiant seul : useCookie le lit comme un nombre', () => {
    setCookie(7)
    expect(freshStore().ids).toEqual([7])
  })

  it('titres et miniatures : en mémoire seulement, jamais dans le cookie', () => {
    const compare = freshStore()
    compare.toggle(mascara)
    expect(compare.items).toEqual([mascara])
    expect(JSON.stringify(cookieValue())).not.toContain('Mascara')
    expect(JSON.stringify(cookieValue())).not.toContain('cdn')
  })

  it('après un rechargement : identifiants connus sans titre, puis rechargés', () => {
    setCookie('1,2')
    const compare = freshStore()
    expect(compare.unknownIds).toEqual([1, 2])
    // Repli lisible en attendant la réponse de l'API.
    expect(compare.items[0]).toEqual({ id: 1, title: 'Produit n° 1', thumbnail: '' })

    compare.remember([mascara])
    expect(compare.unknownIds).toEqual([2])
    expect(compare.items[0]).toEqual(mascara)
  })

  it('produit inconnu de l’API (404) : retiré sans annonce', () => {
    setCookie('1,9999')
    const compare = freshStore()
    compare.drop([9999])
    expect(compare.ids).toEqual([1])
    expect(cookieValue()).toBe('1')
    expect(compare.announcement).toBe('')
  })

  it('clear : sélection vidée', () => {
    const compare = freshStore()
    compare.toggle(mascara)
    compare.clear()
    expect(compare.ids).toEqual([])
  })
})
