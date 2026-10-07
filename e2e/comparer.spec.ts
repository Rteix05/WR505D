import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Un produit comparé = un en-tête de colonne du tableau (#48).
const compared = (page: Page) => page.getByRole('main').getByRole('columnheader')
// La zone de statut de la page (copie du lien) est la première du <main> : le tableau (#48)
// a la sienne, plus bas, pour annoncer les lignes masquées.
const status = (page: Page) => page.getByRole('main').getByRole('status').first()

/**
 * Attend que Vue ait hydraté la page : avant, le HTML du serveur est affiché mais les boutons
 * ne réagissent pas encore. Indispensable avant un clic ou une touche quand la suite tourne en
 * parallèle et que la page met plus de temps à s'hydrater.
 */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: unknown }) | null
    return root?.__vue_app__ !== undefined
  })
}

test.describe('Page /comparer', () => {
  test('affiche les produits de l’URL, dans l’ordre', async ({ page }) => {
    await page.goto('/comparer?ids=3,1,2')
    await expect(compared(page)).toHaveCount(3)
    await expect(compared(page).first().getByRole('link')).toHaveText('Powder Canister')
    await expect(page).toHaveTitle(/^Comparer : Powder Canister, Essence Mascara/)
  })

  const invalidUrls: Array<[label: string, url: string, expected: string]> = [
    ['doublons et invalides', '/comparer?ids=2,abc,2,,1', 'ids=2,1'],
    ['au-delà de 3', '/comparer?ids=1,2,3,4,5', 'ids=1,2,3'],
    ['produit inexistant retiré', '/comparer?ids=1,999999,2', 'ids=1,2'],
    ['paramètre répété', '/comparer?ids=1&ids=2', 'ids=1,2'],
  ]
  // Playwright n'a pas de test.each (contrairement à Vitest) : une boucle génère un test par cas.
  for (const [label, url, expected] of invalidUrls) {
    test(`URL invalide (${label}) : normalisée, sans erreur`, async ({ page }) => {
      const response = await page.goto(url)
      expect(response?.status()).toBe(200)
      await expect(page).toHaveURL(
        (current) => current.pathname === '/comparer' && current.search === `?${expected}`,
      )
    })
  }

  test('rien de valide : URL nettoyée et état vide avec lien vers le catalogue', async ({
    page,
  }) => {
    await page.goto('/comparer?ids=abc,999999')
    await expect(page).toHaveURL(/\/comparer$/)
    await expect(page.getByText('Aucun produit à comparer.')).toBeVisible()
    await page.getByRole('link', { name: 'Parcourir le catalogue' }).click()
    await expect(page).toHaveURL(/\/produits$/)
  })

  test('copier le lien : URL canonique dans le presse-papiers, confirmation annoncée', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/comparer?ids=2,2,1')
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Copier le lien' }).click()

    await expect(status(page)).toHaveText('Lien copié dans le presse-papiers.')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/^http:\/\/localhost:\d+\/comparer\?ids=2,1$/)
  })

  test('copier le lien sans Clipboard API : repli avec le lien sélectionné', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    })
    await page.goto('/comparer?ids=1,2')
    await waitForHydration(page)
    await page.getByRole('button', { name: 'Copier le lien' }).focus()
    await page.keyboard.press('Enter')

    await expect(status(page)).toContainText('Copie automatique impossible')
    const field = page.getByLabel('Lien de cette comparaison')
    await expect(field).toHaveValue(/\/comparer\?ids=1,2$/)
    await expect(field).toBeFocused()
  })

  test('aucune violation d’accessibilité', async ({ page }) => {
    await page.goto('/comparer?ids=1,2,3')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})

test.describe('Page /comparer sans JavaScript (lien partagé, fenêtre privée)', () => {
  test.use({ javaScriptEnabled: false })

  test('les produits du lien sont dans le HTML du serveur', async ({ page }) => {
    await page.goto('/comparer?ids=1,2,3')
    await expect(compared(page)).toHaveCount(3)
  })

  test('URL invalide : redirection du serveur vers l’URL canonique', async ({ page }) => {
    const response = await page.goto('/comparer?ids=3,3,abc,1')
    expect(response?.request().redirectedFrom()?.url()).toMatch(/ids=3,3,abc,1$/)
    await expect(page).toHaveURL(/\/comparer\?ids=3,1$/)
    await expect(compared(page)).toHaveCount(2)
  })
})
