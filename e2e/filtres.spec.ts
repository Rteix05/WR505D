import { expect, test, type Page } from '@playwright/test'

const status = (page: Page) => page.getByRole('status')
const products = (page: Page) => page.getByRole('main').getByRole('article')
const categorySelect = (page: Page) => page.getByLabel('Catégorie')
const sortSelect = (page: Page) => page.getByLabel('Trier par')
const applyButton = (page: Page) => page.getByRole('button', { name: 'Appliquer' })

test.describe('Filtres et tri du catalogue', () => {
  test('catégorie + tri : l’URL, la liste et le statut suivent', async ({ page }) => {
    await page.goto('/produits')
    await categorySelect(page).selectOption({ label: 'Beauty' })
    await sortSelect(page).selectOption({ label: 'Prix décroissant' })
    await applyButton(page).click()

    await expect(page).toHaveURL(/\/produits\?category=beauty&sortBy=price&order=desc$/)
    await expect(status(page)).toHaveText(/^\d+ produits? dans Beauty, page 1 sur \d+$/)

    // Tri décroissant : chaque prix est inférieur ou égal au précédent.
    const prices = (await page.locator('main article').getByText('€').allTextContents()).map(
      (text) => Number(text.replace(/[^\d,]/g, '').replace(',', '.')),
    )
    expect(prices.length).toBeGreaterThan(1)
    expect(prices).toEqual([...prices].sort((a, b) => b - a))
  })

  test('choisir une option ne change rien tant qu’on n’a pas cliqué sur « Appliquer »', async ({
    page,
  }) => {
    await page.goto('/produits')
    await categorySelect(page).selectOption({ label: 'Beauty' })
    await expect(page).toHaveURL(/\/produits$/)
    await expect(products(page)).toHaveCount(12)
  })

  test('au clavier : Entrée sur « Appliquer »', async ({ page }) => {
    await page.goto('/produits')
    await sortSelect(page).selectOption({ label: 'Mieux notés' })
    await applyButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/sortBy=rating&order=desc/)
  })

  test('bouton retour : les menus et la liste reviennent à l’état précédent', async ({ page }) => {
    await page.goto('/produits?category=beauty')
    await categorySelect(page).selectOption({ label: 'Smartphones' })
    await applyButton(page).click()
    await expect(status(page)).toContainText('Smartphones')

    await page.goBack()
    await expect(page).toHaveURL(/category=beauty$/)
    await expect(status(page)).toContainText('Beauty')
    await expect(categorySelect(page)).toHaveValue('beauty')
  })

  test('changer le tri depuis la page 2 revient à la page 1', async ({ page }) => {
    await page.goto('/produits?category=smartphones&page=2')
    await sortSelect(page).selectOption({ label: 'Titre (A → Z)' })
    await applyButton(page).click()

    await expect(page).toHaveURL(/category=smartphones&sortBy=title&order=asc$/)
    await expect(status(page)).toHaveText(/page 1 sur/)
  })

  test('« Effacer les filtres » revient au catalogue complet', async ({ page }) => {
    await page.goto('/produits?category=beauty&sortBy=price&order=asc')
    await page.getByRole('link', { name: 'Effacer les filtres' }).click()

    await expect(page).toHaveURL(/\/produits$/)
    await expect(products(page)).toHaveCount(12)
    await expect(categorySelect(page)).toHaveValue('')
  })

  test('catégorie inconnue : message et lien vers tous les produits', async ({ page }) => {
    await page.goto('/produits?category=inconnue')
    await expect(page.getByText('Aucun produit dans cette catégorie.')).toBeVisible()
    await page.getByRole('link', { name: 'Voir tous les produits' }).click()
    await expect(products(page)).toHaveCount(12)
  })
})

test.describe('Filtres sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('le formulaire est envoyé par le navigateur, puis redirigé vers l’URL canonique', async ({
    page,
  }) => {
    await page.goto('/produits')
    await categorySelect(page).selectOption({ label: 'Beauty' })
    await sortSelect(page).selectOption({ label: 'Mieux notés' })
    await applyButton(page).click()

    await expect(page).toHaveURL(/\/produits\?category=beauty&sortBy=rating&order=desc$/)
    await expect(status(page)).toContainText('dans Beauty')
    await expect(categorySelect(page)).toHaveValue('beauty')
    await expect(sortSelect(page)).toHaveValue('rating-desc')
  })
})
