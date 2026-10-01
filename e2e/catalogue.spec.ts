import { expect, test, type Page } from '@playwright/test'

const status = (page: Page) => page.getByRole('status')
const products = (page: Page) => page.getByRole('main').getByRole('article')
const pagination = (page: Page) => page.getByRole('navigation', { name: 'Pagination' })

test.describe('Catalogue /produits', () => {
  test('affiche 12 produits avec prix, note et le nombre total', async ({ page }) => {
    await page.goto('/produits')

    await expect(page.getByRole('heading', { level: 1, name: 'Produits' })).toBeVisible()
    await expect(products(page)).toHaveCount(12)
    await expect(status(page)).toHaveText(/^\d+ produits, page 1 sur \d+$/)
    await expect(products(page).first()).toContainText('€')
    await expect(products(page).first()).toContainText('sur 5')
    await expect(
      pagination(page).getByRole('link', { name: 'Page 1', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('page suivante à la souris, puis bouton retour', async ({ page }) => {
    await page.goto('/produits')
    const firstTitle = await products(page).first().getByRole('link').textContent()

    await pagination(page)
      .getByRole('link', { name: /Suivante/ })
      .click()
    await expect(page).toHaveURL(/\/produits\?page=2$/)
    await expect(status(page)).toHaveText(/page 2 sur/)
    await expect(products(page).first().getByRole('link')).not.toHaveText(firstTitle ?? '')
    await expect(
      pagination(page).getByRole('link', { name: 'Page 2', exact: true }),
    ).toHaveAttribute('aria-current', 'page')

    await page.goBack()
    await expect(page).toHaveURL(/\/produits$/)
    await expect(status(page)).toHaveText(/page 1 sur/)
    await expect(products(page).first().getByRole('link')).toHaveText(firstTitle ?? '')
  })

  test('au clavier : Entrée sur « Suivante », le focus revient sur le titre', async ({ page }) => {
    await page.goto('/produits')

    await pagination(page)
      .getByRole('link', { name: /Suivante/ })
      .focus()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  })

  test('URL invalide : ?page=abc affiche la page 1', async ({ page }) => {
    await page.goto('/produits?page=abc')
    await expect(status(page)).toHaveText(/page 1 sur/)
    await expect(products(page)).toHaveCount(12)
  })

  test('page hors bornes : message et lien vers la première page', async ({ page }) => {
    await page.goto('/produits?page=999')
    await expect(page.getByText(/Cette page n'existe pas/)).toBeVisible()

    await page.getByRole('link', { name: 'Revenir à la première page' }).click()
    await expect(page).toHaveURL(/\/produits$/)
    await expect(products(page)).toHaveCount(12)
  })
})

test.describe('Catalogue sans JavaScript (rendu serveur)', () => {
  test.use({ javaScriptEnabled: false })

  test('les produits et la pagination fonctionnent', async ({ page }) => {
    await page.goto('/produits?page=2')
    await expect(products(page)).toHaveCount(12)
    await expect(status(page)).toHaveText(/page 2 sur/)

    await pagination(page)
      .getByRole('link', { name: /Suivante/ })
      .click()
    await expect(page).toHaveURL(/page=3/)
    await expect(status(page)).toHaveText(/page 3 sur/)
  })
})
