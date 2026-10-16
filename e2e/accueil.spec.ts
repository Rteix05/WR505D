import { expect, test, type Page } from '@playwright/test'

const featured = (page: Page) => page.getByRole('region', { name: 'Les mieux notés' })
const categories = (page: Page) => page.getByRole('region', { name: 'Parcourir par catégorie' })
const perks = (page: Page) => page.getByRole('list', { name: 'Nos avantages' })

test.describe('Accueil', () => {
  test('bandeau, avantages, catégories et produits sont affichés', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Bienvenue sur ChampaShop' }),
    ).toBeVisible()
    await expect(page.getByRole('search').getByLabel('Rechercher un produit')).toBeVisible()
    // Avantages : les vraies règles de la boutique (utils/promotions.ts), pas des textes inventés.
    await expect(perks(page)).toContainText('4,90')
    await expect(perks(page)).toContainText('80,00')
    await expect(perks(page)).toContainText('TROYES10')
    await expect(categories(page).getByRole('link')).toHaveCount(8)
    await expect(featured(page).getByRole('article')).toHaveCount(8)
    await expect(featured(page).getByRole('article').first()).toContainText('€')
  })

  test('les produits sont les mieux notés, du plus haut au plus bas', async ({ page }) => {
    await page.goto('/')
    const ratings = (
      await featured(page)
        .getByRole('article')
        .getByText(/^Note :/)
        .allTextContents()
    ).map((text) => Number(text.replace(/[^\d,]/g, '').replace(',', '.')))
    // Sinon l'ordre pourrait être celui du catalogue, sans que rien ne le signale.
    expect(ratings).toHaveLength(8)
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a))
  })

  test('une catégorie mène au catalogue déjà filtré', async ({ page }) => {
    await page.goto('/')
    await categories(page).getByRole('link', { name: 'Beauté' }).click()

    await expect(page).toHaveURL(/\/produits\?category=beauty$/)
    await expect(page.getByRole('main').getByRole('status')).toContainText('Beauty')
  })

  test('un produit mène à sa fiche', async ({ page }) => {
    await page.goto('/')
    const first = featured(page).getByRole('article').first().getByRole('link').first()
    const title = (await first.textContent())?.trim() ?? ''

    await first.click()
    await expect(page).toHaveURL(/\/produits\/\d+$/)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  })

  test('« Voir tout le catalogue » garde le tri par note', async ({ page }) => {
    await page.goto('/')
    await featured(page).getByRole('link', { name: 'Voir tout le catalogue' }).click()
    await expect(page).toHaveURL(/\/produits\?sortBy=rating&order=desc$/)
  })

  test('recherche depuis le bandeau, au clavier', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('search').getByLabel('Rechercher un produit').fill('mascara')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/produits\?q=mascara$/)
    await expect(page.getByRole('main').getByRole('status')).toContainText('mascara')
  })

  test('de l’accueil à un autre écran et retour : les produits ne sont pas rechargés', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(featured(page).getByRole('article')).toHaveCount(8)
    // Seuls comptent les appels faits PAR LE NAVIGATEUR : ceux du serveur lui sont invisibles.
    const calls: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('dummyjson.com/products?limit=8')) calls.push(request.url())
    })

    await page.getByRole('link', { name: 'Connexion', exact: true }).first().click()
    await expect(page).toHaveURL(/\/connexion$/)
    await page.getByRole('link', { name: 'Accueil', exact: true }).first().click()

    await expect(featured(page).getByRole('article')).toHaveCount(8)
    expect(calls).toEqual([])
  })

  test('aucun débordement horizontal sur mobile (375 px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')
    await expect(featured(page).getByRole('article')).toHaveCount(8)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    // Le panier reste à côté du logo : nom accessible conservé même sans le texte visible.
    await expect(page.getByRole('banner').getByRole('link', { name: /^Panier/ })).toBeVisible()
  })
})

test.describe('Accueil sans JavaScript (rendu serveur)', () => {
  test.use({ javaScriptEnabled: false })

  test('produits et catégories sont dans le HTML, la recherche du bandeau fonctionne', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(featured(page).getByRole('article')).toHaveCount(8)
    await expect(categories(page).getByRole('link')).toHaveCount(8)

    await page.getByRole('search').getByLabel('Rechercher un produit').fill('phone')
    await page.getByRole('search').getByRole('button', { name: 'Rechercher' }).click()
    await expect(page).toHaveURL(/\/produits\?q=phone$/)
    await expect(page.getByRole('main').getByRole('article').first()).toBeVisible()
  })
})
