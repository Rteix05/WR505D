import { describe, expect, it } from 'vitest'
import { errorPageTitle } from '../../utils/errorPage'

describe('errorPageTitle', () => {
  it('404 avec un titre donné par la page (fiche produit), navigation côté client', () => {
    expect(errorPageTitle(404, { title: 'Produit introuvable' })).toBe('Produit introuvable')
  })

  it('404 rendue par le serveur : data arrive en texte JSON', () => {
    expect(errorPageTitle(404, '{"title":"Produit introuvable"}')).toBe('Produit introuvable')
  })

  // Cas signalé en review de #36 : Nuxt met « Page not found: /… » dans statusMessage,
  // mais rien dans data. Le titre ne doit jamais être en anglais.
  it.each([
    ['sans data (route inconnue)', undefined],
    ['data null', null],
    ['data sans titre', { path: '/nexiste-pas' }],
    ['titre vide', { title: '  ' }],
    ['titre qui n’est pas une chaîne', { title: 42 }],
    ['data texte qui n’est pas du JSON', 'Page not found: /nexiste-pas'],
    ['data texte JSON sans titre', '{"path":"/nexiste-pas"}'],
  ])('404 %s : « Page introuvable »', (_label, data) => {
    expect(errorPageTitle(404, data)).toBe('Page introuvable')
  })

  it('autre erreur (500) : titre générique, même avec un titre fourni', () => {
    expect(errorPageTitle(500, { title: 'Produit introuvable' })).toBe('Une erreur est survenue')
  })
})
