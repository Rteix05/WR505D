import { describe, expect, it } from 'vitest'
import {
  COMPARE_FULL_MESSAGE,
  compareBarLabel,
  compareButtonName,
  compareLink,
  compareRemoveName,
  compareToggleMessage,
} from '../../utils/compareSelection'

describe('compareBarLabel', () => {
  it('« Comparer (2/3) »', () => {
    expect(compareBarLabel(2)).toBe('Comparer (2/3)')
    expect(compareBarLabel(3)).toBe('Comparer (3/3)')
  })
})

describe('compareToggleMessage', () => {
  it('ajout : produit et compteur annoncés', () => {
    expect(compareToggleMessage('Mascara', { added: true, rejected: false }, 2)).toBe(
      '« Mascara » ajouté au comparateur (2/3).',
    )
  })

  it('retrait : produit et compteur annoncés', () => {
    expect(compareToggleMessage('Mascara', { added: false, rejected: false }, 1)).toBe(
      '« Mascara » retiré du comparateur (1/3).',
    )
  })

  it('4ᵉ produit refusé : le message imposé par l’issue, mot pour mot', () => {
    expect(compareToggleMessage('Mascara', { added: false, rejected: true }, 3)).toBe(
      'Comparateur plein : retirez un produit pour en ajouter un autre',
    )
    expect(COMPARE_FULL_MESSAGE).toBe(
      'Comparateur plein : retirez un produit pour en ajouter un autre',
    )
  })
})

describe('noms accessibles', () => {
  // WCAG 2.5.3 : le nom accessible doit contenir le texte visible du bouton.
  it('le bouton bascule contient « Comparer »', () => {
    expect(compareButtonName('Mascara')).toBe('Comparer Mascara')
    expect(compareButtonName('Mascara')).toContain('Comparer')
  })

  it('le retrait nomme le produit', () => {
    expect(compareRemoveName('Mascara')).toBe('Retirer Mascara du comparateur')
  })
})

describe('compareLink', () => {
  it('identifiants dans l’ordre de la sélection', () => {
    expect(compareLink([3, 17, 42])).toBe('/comparer?ids=3,17,42')
    expect(compareLink([5])).toBe('/comparer?ids=5')
  })

  it('rien à comparer : pas de lien', () => {
    expect(compareLink([])).toBeNull()
  })
})
