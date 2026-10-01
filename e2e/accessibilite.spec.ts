import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Contrôle automatique WCAG 2.1 AA avec axe-core (le moteur de l'audit accessibilité
// de Lighthouse). Il ne remplace pas un test au clavier, mais bloque les régressions
// détectables : contraste, labels, noms accessibles, structure des titres…
const PAGES = [
  '/',
  '/produits',
  '/produits?page=2',
  '/produits?category=beauty&sortBy=price&order=desc',
  '/connexion',
]

for (const path of PAGES) {
  test(`aucune violation d'accessibilité sur ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.getByRole('heading', { level: 1 }).waitFor()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    // Message lisible en cas d'échec : règle, gravité et éléments concernés.
    const violations = results.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }))
    expect(violations).toEqual([])
  })
}
