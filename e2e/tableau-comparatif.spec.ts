import { expect, test, type Page } from '@playwright/test'

const table = (page: Page) => page.getByRole('main').getByRole('table')
const rowHeaders = (page: Page) => table(page).getByRole('rowheader')
const row = (page: Page, label: string) =>
  table(page)
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
const onlyDifferences = (page: Page) => page.getByLabel('Afficher uniquement les différences')

/** Attend l'hydratation : l'option « différences » n'existe qu'avec JavaScript. */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: unknown }) | null
    return root?.__vue_app__ !== undefined
  })
}

// Produits 1 (mascara 9,99 €, stock 99), 2 (palette 19,99 €) et 3 (poudre, note 4,64).
test.describe('Tableau comparatif', () => {
  test('vrai tableau : légende, produits en colonnes, caractéristiques en lignes', async ({
    page,
  }) => {
    await page.goto('/comparer?ids=1,2,3')
    await expect(table(page)).toHaveAccessibleName('Comparaison de 3 produits')
    await expect(table(page).getByRole('columnheader')).toHaveText([
      'Essence Mascara Lash Princess',
      'Eyeshadow Palette with Mirror',
      'Powder Canister',
    ])
    await expect(rowHeaders(page)).toHaveText([
      'Prix',
      'Remise',
      'Note',
      'Disponibilité',
      'Stock',
      'Marque',
      'Catégorie',
      'Poids',
      'Dimensions (l × h × p)',
      'Garantie',
      'Livraison',
    ])
  })

  test('meilleures valeurs signalées par un texte, dans la bonne colonne', async ({ page }) => {
    await page.goto('/comparer?ids=1,2,3')
    const cells = (label: string) => row(page, label).getByRole('cell')
    await expect(cells('Prix').nth(0)).toContainText('Meilleur prix')
    await expect(cells('Prix').nth(1)).not.toContainText('Meilleur prix')
    await expect(cells('Note').nth(2)).toContainText('Meilleure note')
    await expect(cells('Stock').nth(0)).toContainText('Stock le plus élevé')
  })

  test('« Afficher uniquement les différences » au clavier, annoncé, puis retour', async ({
    page,
  }) => {
    await page.goto('/comparer?ids=1,2,3')
    await waitForHydration(page)
    await expect(rowHeaders(page)).toHaveCount(11)

    await onlyDifferences(page).focus()
    await page.keyboard.press('Space')
    // Les 3 produits sont « En stock » et dans « Beauty » : ces lignes disparaissent.
    await expect(row(page, 'Disponibilité')).toHaveCount(0)
    await expect(row(page, 'Catégorie')).toHaveCount(0)
    await expect(row(page, 'Prix')).toHaveCount(1)
    await expect(
      page.getByRole('main').getByRole('status').filter({ hasText: 'masquée' }),
    ).toHaveText(/^\d+ lignes? identiques? masquées?\.$/)

    await page.keyboard.press('Space')
    await expect(rowHeaders(page)).toHaveCount(11)
  })

  test('un seul produit : pas d’option « différences », pas de « meilleur »', async ({ page }) => {
    await page.goto('/comparer?ids=1')
    await waitForHydration(page)
    await expect(table(page)).toHaveAccessibleName('Caractéristiques du produit')
    await expect(onlyDifferences(page)).toHaveCount(0)
    await expect(table(page)).not.toContainText('Meilleur')
  })

  test('mobile : le tableau défile dans sa zone, la page ne déborde pas, 1re colonne figée', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/comparer?ids=1,2,3')
    const region = page.getByRole('region', { name: 'Comparaison de 3 produits' })

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)

    // La zone est atteignable au clavier, et les flèches la font défiler.
    await region.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)

    // Après défilement, l'en-tête de ligne reste collé au bord gauche de la zone.
    const header = rowHeaders(page).first()
    const [regionLeft, headerLeft] = await Promise.all([
      region.evaluate((element) => element.getBoundingClientRect().left),
      header.evaluate((element) => element.getBoundingClientRect().left),
    ])
    expect(Math.abs(headerLeft - regionLeft)).toBeLessThanOrEqual(2)
  })
})

test.describe('Tableau comparatif sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('tableau complet dans le HTML du serveur, sans option inutilisable', async ({ page }) => {
    await page.goto('/comparer?ids=1,2,3')
    await expect(rowHeaders(page)).toHaveCount(11)
    await expect(row(page, 'Prix').getByRole('cell').first()).toContainText('Meilleur prix')
    await expect(onlyDifferences(page)).toHaveCount(0)
  })
})
