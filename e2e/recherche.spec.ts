import { expect, test, type Page } from '@playwright/test'

const status = (page: Page) => page.getByRole('status')
const products = (page: Page) => page.getByRole('main').getByRole('article')
const searchInput = (page: Page) => page.getByLabel('Rechercher un produit')

/** Compte les requêtes vers /products/search. */
function countSearchRequests(page: Page): string[] {
  const queries: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/products/search') queries.push(url.searchParams.get('q') ?? '')
  })
  return queries
}

test.describe('Recherche dans le catalogue', () => {
  test('frappe rapide : une seule requête, URL et statut mis à jour', async ({ page }) => {
    await page.goto('/produits')
    const queries = countSearchRequests(page)

    await searchInput(page).pressSequentially('phone', { delay: 50 })

    await expect(page).toHaveURL(/\/produits\?q=phone$/)
    await expect(status(page)).toHaveText(/^\d+ produits pour « phone », page 1 sur \d+$/)
    expect(queries).toEqual(['phone'])
    // Le focus reste dans le champ : on peut continuer à taper.
    await expect(searchInput(page)).toBeFocused()
  })

  test('une réponse ancienne n’écrase jamais la plus récente', async ({ page }) => {
    // « pho » répond en 2 s, « phone » tout de suite : sans anti-race, « pho »
    // arriverait en dernier et remplacerait les résultats de « phone ».
    await page.route('**/products/search?*', async (route) => {
      const q = new URL(route.request().url()).searchParams.get('q')
      if (q === 'pho') await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.continue().catch(() => {}) // requête annulée entre-temps
    })
    // Playwright ne signale pas l'annulation d'une requête qu'il retient (page.route) :
    // on l'observe depuis la page, sur le signal passé à fetch.
    await page.addInitScript(() => {
      const aborted: string[] = []
      Object.assign(window, { abortedSearches: aborted })
      const originalFetch = window.fetch
      window.fetch = (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input))
        if (url.pathname === '/products/search') {
          init?.signal?.addEventListener('abort', () =>
            aborted.push(url.searchParams.get('q') ?? ''),
          )
        }
        return originalFetch(input, init)
      }
    })
    await page.goto('/produits')

    await searchInput(page).fill('pho')
    await page.waitForTimeout(400) // debounce écoulé : la requête « pho » est partie
    await searchInput(page).fill('phone')

    await expect(status(page)).toHaveText(/pour « phone »/)
    await page.waitForTimeout(2500) // la réponse lente de « pho » a eu le temps d'arriver
    await expect(page).toHaveURL(/q=phone$/)
    await expect(status(page)).toHaveText(/pour « phone »/)
    // La requête « pho » a été interrompue côté réseau, pas seulement ignorée.
    expect(await page.evaluate(() => Reflect.get(window, 'abortedSearches'))).toEqual(['pho'])
  })

  test('la recherche revient à la page 1 et garde le tri', async ({ page }) => {
    await page.goto('/produits?sortBy=price&order=desc&page=3')
    await searchInput(page).fill('phone')
    await searchInput(page).press('Enter')

    await expect(page).toHaveURL(/\/produits\?q=phone&sortBy=price&order=desc$/)
    await expect(status(page)).toHaveText(/page 1 sur/)
    await expect(searchInput(page)).toBeFocused()
  })

  test('recherche + catégorie : seuls les produits de la catégorie', async ({ page }) => {
    // L'API ignore `category` dans une recherche : filtrage fait par l'application.
    await page.goto('/produits?q=phone&category=smartphones')
    await expect(status(page)).toHaveText(/pour « phone » dans Smartphones/)
    const count = await products(page).count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(23) // 23 résultats pour « phone » toutes catégories
  })

  test('aucun résultat : message et lien pour effacer la recherche', async ({ page }) => {
    await page.goto('/produits?q=zzzz')
    await expect(page.getByText('Aucun produit ne correspond à « zzzz ».')).toBeVisible()

    await page.getByRole('link', { name: 'Effacer la recherche' }).click()
    await expect(page).toHaveURL(/\/produits$/)
    await expect(products(page)).toHaveCount(12)
    await expect(searchInput(page)).toHaveValue('')
  })

  test('bouton retour : une seule entrée d’historique par recherche', async ({ page }) => {
    await page.goto('/produits')
    await searchInput(page).pressSequentially('pho', { delay: 50 })
    await expect(page).toHaveURL(/q=pho$/)
    await searchInput(page).pressSequentially('ne', { delay: 400 }) // 2 recherches : « phon », « phone »
    await expect(page).toHaveURL(/q=phone$/)

    await page.goBack()
    await expect(page).toHaveURL(/\/produits$/)
    await expect(searchInput(page)).toHaveValue('')
    await expect(products(page)).toHaveCount(12)
  })
})

test.describe('Recherche sans JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('le formulaire est envoyé par le navigateur, filtres conservés', async ({ page }) => {
    await page.goto('/produits?category=smartphones')
    await searchInput(page).fill('  iphone ')
    await page.getByRole('button', { name: 'Rechercher' }).click()

    // Espaces retirés par la redirection vers l'URL canonique.
    await expect(page).toHaveURL(/\/produits\?q=iphone&category=smartphones$/)
    await expect(status(page)).toHaveText(/pour « iphone » dans Smartphones/)
  })
})
