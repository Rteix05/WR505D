import { describe, expect, it } from 'vitest'
import { httpStatusOf, loginErrorMessage, safeRedirect, toAuthUser } from '../../utils/auth'
import type { User } from '../../types/dummyjson'

describe('toAuthUser', () => {
  it('ne garde que les champs utiles, jamais les données sensibles', () => {
    const me = {
      id: 1,
      username: 'emilys',
      email: 'emily.johnson@x.dummyjson.com',
      firstName: 'Emily',
      lastName: 'Johnson',
      gender: 'female',
      image: 'https://dummyjson.com/icon/emilys/128',
      maidenName: 'Smith',
      age: 29,
      phone: '+81 965-431-3024',
      birthDate: '1996-5-30',
      role: 'admin',
      // Champs réellement renvoyés par /auth/me mais absents du type
      password: 'emilyspass',
      bank: { cardNumber: '3693233511855044' },
    } satisfies User & Record<string, unknown>

    expect(toAuthUser(me)).toEqual({
      id: 1,
      username: 'emilys',
      email: 'emily.johnson@x.dummyjson.com',
      firstName: 'Emily',
      lastName: 'Johnson',
      image: 'https://dummyjson.com/icon/emilys/128',
    })
  })
})

describe('safeRedirect', () => {
  it('accepte un chemin interne, avec query et hash', () => {
    expect(safeRedirect('/compte')).toBe('/compte')
    expect(safeRedirect('/produits?page=2&q=rouge#liste')).toBe('/produits?page=2&q=rouge#liste')
  })

  it('prend la première valeur si la query est répétée', () => {
    expect(safeRedirect(['/panier', '/compte'])).toBe('/panier')
  })

  it.each([
    ['absent', undefined],
    ['null', null],
    ['vide', ''],
    ['URL absolue', 'https://evil.example'],
    ['URL sans protocole', '//evil.example'],
    ['antislash', '/\\evil.example'],
    ['chemin relatif', 'compte'],
    ['javascript:', 'javascript:alert(1)'],
    ['page de connexion', '/connexion'],
    ['page de connexion avec query', '/connexion?redirect=/compte'],
    ['page de connexion avec slash final', '/connexion/'],
    ['page de connexion avec hash', '/connexion#formulaire'],
    ['page de connexion en majuscules', '/Connexion'],
  ])('refuse une cible dangereuse ou inutile (%s)', (_label, target) => {
    expect(safeRedirect(target)).toBe('/')
  })

  it('accepte une page dont le nom commence par « connexion »', () => {
    expect(safeRedirect('/connexions-recentes')).toBe('/connexions-recentes')
  })

  it('utilise le repli fourni', () => {
    expect(safeRedirect(undefined, '/compte')).toBe('/compte')
  })
})

describe('httpStatusOf', () => {
  it('lit le statusCode d’une erreur $fetch', () => {
    expect(httpStatusOf({ statusCode: 400 })).toBe(400)
  })

  it.each([
    ['erreur réseau', new TypeError('fetch failed')],
    ['null', null],
    ['chaîne', 'erreur'],
    ['statusCode non numérique', { statusCode: '400' }],
  ])('renvoie undefined sinon (%s)', (_label, error) => {
    expect(httpStatusOf(error)).toBeUndefined()
  })
})

describe('loginErrorMessage', () => {
  it('identifiants refusés (400 ou 401)', () => {
    expect(loginErrorMessage({ statusCode: 400 })).toBe('Identifiant ou mot de passe incorrect.')
    expect(loginErrorMessage({ statusCode: 401 })).toBe('Identifiant ou mot de passe incorrect.')
  })

  it('serveur injoignable', () => {
    expect(loginErrorMessage(new TypeError('fetch failed'))).toContain('Impossible de joindre')
  })

  it('erreur serveur', () => {
    expect(loginErrorMessage({ statusCode: 500 })).toContain('indisponible')
  })
})
