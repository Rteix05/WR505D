import { expect, test, type Page } from '@playwright/test'

const status = (page: Page) => page.getByRole('status')
const products = (page: Page) => page.getByRole('main').getByRole('article')
const minPrice = (page: Page) => page.getByLabel('Minimum')
const maxPrice = (page: Page) => page.getByLabel('Maximum')
const applyButton = (page: Page) => page.getByRole('button', { name: 'Appliquer' })

/** Prix affichés sur les cartes, en euros (« 1 099,99 € » → 1099.99). */
async function displayedPrices(page: Page): Promise<number[]> {
  const texts = await products(page).locator('.card__price').allTextContents()
  return texts.map((text) => Number(text.replace(/[^\d,]/g, '').replace(',', '.')))
}

/** Compte les appels à l'API produits (hors fiche produit et catégories). */
function countProductRequests(page: Page): { count: number } {
  const counter = { count: 0 }
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname === 'dummyjson.com' && url.pathname !== '/products/categories') {
      counter.count += 1
    }
  })
  return counter
}

test.describe('Filtre prix min / max', () => {
  test('fourchette appliquée : URL, statut, et seuls des prix dans la fourchette', async ({
    page,
  }) => {
    await page.goto('/produits')
    await minPrice(page).fill('10')
    await maxPrice(page).fill('20')
    await applyButton(page).click()

    await expect(page).toHaveURL(/\/produits\?minPrice=10&maxPrice=20$/)
    await expect(status(page)).toHaveText(
      /^\d+ produits entre 10,00\s€ et 20,00\s€, page 1 sur \d+$/,
    )
    const prices = await displayedPrices(page)
    expect(prices).toHaveLength(12)
    for (const price of prices) expect(price).toBeGreaterThanOrEqual(10)
    for (const price of prices) expect(price).toBeLessThanOrEqual(20)
  })

  test('pagination : la dernière page est complète et toujours filtrée, 1 appel par page', async ({
    page,
  }) => {
    await page.goto('/produits?minPrice=10&maxPrice=20')
    const total = Number((await status(page).textContent())?.match(/^(\d+)/)?.[1])
    const lastPage = Math.ceil(total / 12)
    const requests = countProductRequests(page)

    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: `Page ${lastPage}`, exact: true })
      .click()

    await expect(status(page)).toHaveText(new RegExp(`page ${lastPage} sur ${lastPage}$`))
    expect(await products(page).count()).toBe(total - (lastPage - 1) * 12)
    for (const price of await displayedPrices(page)) {
      expect(price).toBeGreaterThanOrEqual(10)
      expect(price).toBeLessThanOrEqual(20)
    }
    expect(requests.count).toBe(1)
  })

  test('prix + catégorie + tri combinés', async ({ page }) => {
    await page.goto('/produits?category=beauty&sortBy=price&order=desc&maxPrice=10')
    await expect(status(page)).toHaveText(/dans Beauty jusqu'à 10,00\s€/)
    const prices = await displayedPrices(page)
    expect(prices.length).toBeGreaterThan(0)
    expect(prices).toEqual([...prices].sort((a, b) => b - a))
    for (const price of prices) expect(price).toBeLessThanOrEqual(10)
  })

  test('saisie invalide : message relié au champ, focus dessus, rien ne change', async ({
    page,
  }) => {
    await page.goto('/produits')
    await maxPrice(page).fill('abc')
    await applyButton(page).click()

    await expect(
      page.getByRole('alert').filter({ hasText: 'Saisissez un prix positif' }),
    ).toBeVisible()
    await expect(maxPrice(page)).toBeFocused()
    await expect(maxPrice(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(page).toHaveURL(/\/produits$/)
  })

  test('au clavier : saisie puis Entrée dans le champ', async ({ page }) => {
    await page.goto('/produits')
    await minPrice(page).focus()
    await page.keyboard.type('100')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/produits\?minPrice=100$/)
    await expect(status(page)).toHaveText(/à partir de 100,00\s€/)
  })

  test('aucun résultat : message et lien qui retire seulement le prix', async ({ page }) => {
    await page.goto('/produits?category=beauty&minPrice=1000')
    await expect(
      page.getByText(/^Aucun produit dans Beauty à partir de 1\s000,00\s€\.$/),
    ).toBeVisible()

    await page.getByRole('link', { name: 'Effacer le filtre de prix' }).click()
    await expect(page).toHaveURL(/\/produits\?category=beauty$/)
    await expect(products(page)).not.toHaveCount(0)
  })
})

test.describe('Filtre prix sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('le formulaire est envoyé puis redirigé vers l’URL canonique', async ({ page }) => {
    await page.goto('/produits?q=phone')
    await minPrice(page).fill('10')
    await maxPrice(page).fill('50,5')
    await applyButton(page).click()

    await expect(page).toHaveURL(/\/produits\?q=phone&minPrice=10&maxPrice=50.5$/)
    await expect(status(page)).toHaveText(/pour « phone » entre 10,00\s€ et 50,50\s€/)
    for (const price of await displayedPrices(page)) {
      expect(price).toBeGreaterThanOrEqual(10)
      expect(price).toBeLessThanOrEqual(50.5)
    }
  })
})
