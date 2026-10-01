import { expect, test, type Page } from '@playwright/test'

// Produits de l'API de démonstration DummyJSON (données fixes) :
// 1 : en stock, une seule image ; 9 : 4 en stock, 3 images ; 117 : rupture de stock.
const IN_STOCK = '/produits/1'
const LOW_STOCK = '/produits/9'
const OUT_OF_STOCK = '/produits/117'

const main = (page: Page) => page.getByRole('main')
const addButton = (page: Page) => page.getByRole('button', { name: 'Ajouter au panier' })
const cartLink = (page: Page) => page.getByRole('banner').getByRole('link', { name: /^Panier/ })

test.describe('Fiche produit /produits/[id]', () => {
  test('affiche titre, marque, note, prix, stock, description, garantie et livraison', async ({
    page,
  }) => {
    await page.goto(IN_STOCK)

    await expect(
      page.getByRole('heading', { level: 1, name: 'Essence Mascara Lash Princess' }),
    ).toBeVisible()
    await expect(main(page)).toContainText('Marque : Essence')
    await expect(main(page)).toContainText('sur 5')
    await expect(main(page)).toContainText('€')
    await expect(main(page)).toContainText('En stock')
    await expect(page.getByRole('heading', { level: 2, name: 'Description' })).toBeVisible()
    await expect(main(page).getByRole('term').filter({ hasText: 'Garantie' })).toBeVisible()
    await expect(main(page).getByRole('term').filter({ hasText: 'Livraison' })).toBeVisible()

    // SEO : titre, description et image Open Graph.
    await expect(page).toHaveTitle(/Essence Mascara Lash Princess/)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /mascara/i)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /^https:\/\/cdn\.dummyjson\.com\//,
    )
  })

  test('depuis le catalogue, puis bouton retour', async ({ page }) => {
    await page.goto('/produits')
    const firstCard = main(page).getByRole('article').first().getByRole('link')
    const title = (await firstCard.textContent())?.trim() ?? ''

    await firstCard.click()
    await expect(page).toHaveURL(/\/produits\/\d+$/)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/\/produits$/)
  })

  test('galerie : la miniature choisie remplace l’image principale (souris et clavier)', async ({
    page,
  }) => {
    await page.goto(LOW_STOCK)
    const thumbs = page.getByRole('list', { name: 'Choisir une image' }).getByRole('button')
    await expect(thumbs).toHaveCount(3)
    await expect(thumbs.first()).toHaveAttribute('aria-current', 'true')

    await thumbs.nth(1).click()
    await expect(main(page).getByRole('img', { name: /image 2 sur 3$/ })).toBeVisible()
    await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')

    await thumbs.nth(2).focus()
    await page.keyboard.press('Enter')
    await expect(main(page).getByRole('img', { name: /image 3 sur 3$/ })).toBeVisible()
  })

  test('une seule image : pas de miniatures', async ({ page }) => {
    await page.goto(IN_STOCK)
    await expect(page.getByRole('list', { name: 'Choisir une image' })).toHaveCount(0)
  })

  test('ajout au panier : confirmation annoncée et badge de l’en-tête mis à jour', async ({
    page,
  }) => {
    await page.goto(IN_STOCK)
    await expect(cartLink(page)).toHaveAccessibleName('Panier, 0 article')

    await addButton(page).click()

    await expect(main(page).getByRole('status')).toHaveText(
      '« Essence Mascara Lash Princess » a été ajouté au panier.',
    )
    await expect(cartLink(page)).toHaveAccessibleName('Panier, 1 article')
    await expect(main(page)).toContainText('Déjà 1 dans votre panier.')
  })

  test('stock faible : « Plus que 4 en stock », puis limite atteinte expliquée', async ({
    page,
  }) => {
    await page.goto(LOW_STOCK)
    await expect(main(page)).toContainText('Plus que 4 en stock')

    // Au clavier : 5 appuis sur Entrée, le 5ᵉ dépasse le stock.
    await addButton(page).focus()
    for (let i = 0; i < 5; i++) await page.keyboard.press('Enter')

    await expect(main(page).getByRole('status')).toHaveText(
      'Vous avez déjà les 4 exemplaires disponibles dans votre panier.',
    )
    await expect(cartLink(page)).toHaveAccessibleName('Panier, 4 articles')
  })

  test('rupture : « Rupture de stock » et bouton désactivé', async ({ page }) => {
    await page.goto(OUT_OF_STOCK)
    await expect(main(page)).toContainText('Rupture de stock')
    await expect(addButton(page)).toBeDisabled()
    // Le bouton annonce aussi la raison (aria-describedby vers le stock).
    await expect(addButton(page)).toHaveAccessibleDescription('Rupture de stock')
  })

  for (const path of ['/produits/99999', '/produits/abc']) {
    test(`identifiant inexistant ou invalide (${path}) : vraie 404`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(404)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Produit introuvable' }),
      ).toBeVisible()
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)

      await page.getByRole('link', { name: 'Voir tous les produits' }).click()
      await expect(page).toHaveURL(/\/produits$/)
      await expect(main(page).getByRole('article')).toHaveCount(12)
    })
  }
})

test.describe('Fiche produit sans JavaScript (rendu serveur)', () => {
  test.use({ javaScriptEnabled: false })

  test('la fiche est complète dans le HTML du serveur', async ({ page }) => {
    await page.goto(LOW_STOCK)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(main(page)).toContainText('Plus que 4 en stock')
    await expect(main(page).getByRole('img').first()).toBeVisible()
  })

  test('404 renvoyée par le serveur', async ({ page }) => {
    const response = await page.goto('/produits/99999')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1, name: 'Produit introuvable' })).toBeVisible()
  })
})
