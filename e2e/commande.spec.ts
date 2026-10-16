import AxeBuilder from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// Compte de démonstration public de DummyJSON, donné par le sujet.
const DEMO = { username: 'emilys', password: 'emilyspass' }

// Panier du cookie `cart` (format de `serializeCart`) : mascara × 2 (9,99 €) et poudre × 1 (14,99 €).
const CART = {
  items: [
    [1, 2, 999, 'beauty', 99],
    [3, 1, 1499, 'beauty', 89],
  ],
  promoCode: '',
}

const main = (page: Page) => page.getByRole('main')
const cartLink = (page: Page) => page.getByRole('banner').getByRole('link', { name: /^Panier/ })

async function fillCart(context: BrowserContext, baseURL: string | undefined): Promise<void> {
  await context.addCookies([
    { name: 'cart', value: encodeURIComponent(JSON.stringify(CART)), url: baseURL ?? '' },
  ])
}

async function login(page: Page): Promise<void> {
  await page.getByLabel("Nom d'utilisateur").fill(DEMO.username)
  await page.getByLabel('Mot de passe').fill(DEMO.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

/** Attend que Vue ait hydraté la page (avant, le formulaire ne réagit pas encore). */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: unknown }) | null
    return root?.__vue_app__ !== undefined
  })
}

/** Redirigé vers la connexion : `redirect` lu décodé (encodé ou non selon la navigation). */
async function expectLoginRedirect(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/connexion\?redirect=/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/commande')
}

/** Du panier à la page de commande, connexion comprise (redirection du middleware). */
async function openCheckout(page: Page): Promise<void> {
  await page.goto('/panier')
  await page.getByRole('link', { name: 'Valider ma commande' }).click()
  await expectLoginRedirect(page)
  await login(page)
  await expect(page).toHaveURL(/\/commande$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Commande' })).toBeVisible()
  await waitForHydration(page)
}

test.describe('Commande et paiement simulé (#65)', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await fillCart(context, baseURL)
  })

  test('panier → connexion → coordonnées pré-remplies → paiement → confirmation, panier vidé', async ({
    page,
  }) => {
    await openCheckout(page)

    // Profil connecté repris : nom et e-mail déjà saisis.
    await expect(page.getByLabel('Nom et prénom')).toHaveValue('Emily Johnson')
    await expect(page.getByLabel('Adresse e-mail')).toHaveValue('emily.johnson@x.dummyjson.com')
    await expect(main(page)).toContainText('Essence Mascara Lash Princess × 2')

    await page.getByLabel('Adresse', { exact: true }).fill('12 rue de la Cité')
    await page.getByLabel('Code postal').fill('10 000')
    await page.getByLabel('Ville').fill('Troyes')
    // Total du moteur de promotions, pas celui de DummyJSON : 34,97 € - 3,50 € (beauté -10 %
    // dès 3 articles) + 4,90 € de livraison.
    await page.getByRole('button', { name: 'Payer 36,37 € (paiement simulé)' }).click()

    await expect(page).toHaveURL(/\/commande\/confirmation\?numero=\d+$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Merci pour votre commande')
    await expect(cartLink(page)).toHaveAccessibleName('Panier, 0 article')

    // Retour arrière : la commande n'est pas repassée, le panier est vide.
    await page.goBack()
    await expect(page).toHaveURL(/\/commande$/)
    await expect(main(page)).toContainText("Votre panier est vide : il n'y a rien à commander.")
  })

  test('champs invalides : erreurs annoncées, focus sur le premier, rien n’est envoyé', async ({
    page,
  }) => {
    const orders: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/carts/add')) orders.push(request.url())
    })
    await openCheckout(page)

    await page.getByLabel('Adresse e-mail').fill('emily@')
    await page.getByLabel('Code postal').fill('1000')
    await page.getByRole('button', { name: /^Payer/ }).click()

    const email = page.getByLabel('Adresse e-mail')
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription(
      'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.',
    )
    await expect(page.getByLabel('Code postal')).toHaveAccessibleDescription(
      'Le code postal doit comporter 5 chiffres, par exemple 10000.',
    )
    await expect(page.getByLabel('Adresse', { exact: true })).toHaveAccessibleDescription(
      'Saisissez votre adresse.',
    )
    expect(orders).toEqual([])
    await expect(cartLink(page)).toHaveAccessibleName('Panier, 3 articles')
  })

  test('au clavier seul : Tab jusqu’aux champs, Entrée pour payer', async ({ page }) => {
    await openCheckout(page)

    await page.getByLabel('Adresse', { exact: true }).focus()
    await page.keyboard.type('12 rue de la Cité')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Code postal')).toBeFocused()
    await page.keyboard.type('10000')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Ville')).toBeFocused()
    await page.keyboard.type('Troyes')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: /^Payer/ })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/commande\/confirmation\?numero=\d+$/)
  })

  test('erreur de l’API : message annoncé, panier gardé pour réessayer', async ({ page }) => {
    await page.route('**/carts/add', (route) =>
      route.fulfill({ status: 503, json: { message: 'Service unavailable' } }),
    )
    await openCheckout(page)
    await page.getByLabel('Adresse', { exact: true }).fill('12 rue de la Cité')
    await page.getByLabel('Code postal').fill('10000')
    await page.getByLabel('Ville').fill('Troyes')
    await page.getByRole('button', { name: /^Payer/ }).click()

    await expect(main(page).getByRole('alert')).toHaveText(
      'Le paiement est indisponible pour le moment. Votre panier est conservé, réessayez dans quelques instants.',
    )
    await expect(page).toHaveURL(/\/commande$/)
    await expect(cartLink(page)).toHaveAccessibleName('Panier, 3 articles')
  })

  // Suite à la review de #70 : un prix changé depuis l'ajout se voit AVANT de payer.
  test('prix changé depuis l’ajout au panier : annoncé sur la page de commande', async ({
    page,
    context,
    baseURL,
  }) => {
    await openCheckout(page)
    // Le prix change après le passage par /panier (qui resynchronise déjà) : mascara gardé à
    // 5,00 € dans le cookie, alors que l'API le vend 9,99 €. Seule /commande peut le signaler.
    const stale = { items: [[1, 1, 500, 'beauty', 99]], promoCode: '' }
    await context.addCookies([
      { name: 'cart', value: encodeURIComponent(JSON.stringify(stale)), url: baseURL ?? '' },
    ])
    await page.reload()

    await expect(
      main(page).getByRole('list', { name: 'Changements dans votre panier' }),
    ).toContainText('Le prix de « Essence Mascara Lash Princess » a changé : 5,00 € → 9,99 €.')
    await expect(page.getByRole('button', { name: /^Payer 14,89 €/ })).toBeVisible()
  })

  test('aucune violation d’accessibilité sur la commande et la confirmation', async ({ page }) => {
    await openCheckout(page)
    const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
    const onCheckout = await new AxeBuilder({ page }).withTags(tags).analyze()
    expect(onCheckout.violations.map((violation) => violation.id)).toEqual([])

    await page.goto('/commande/confirmation?numero=42')
    const onConfirmation = await new AxeBuilder({ page }).withTags(tags).analyze()
    expect(onConfirmation.violations.map((violation) => violation.id)).toEqual([])
  })
})

test.describe('Confirmation de commande', () => {
  for (const numero of ['abc', '0', '-3', '']) {
    test(`numéro invalide « ${numero} » : vraie 404`, async ({ page }) => {
      const response = await page.goto(`/commande/confirmation?numero=${numero}`)
      expect(response?.status()).toBe(404)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Commande introuvable')
    })
  }

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('la confirmation est rendue par le serveur', async ({ page }) => {
      await page.goto('/commande/confirmation?numero=42')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Merci pour votre commande')
      await expect(page.getByRole('main')).toContainText('Commande n° 42 simulée.')
    })

    test('le lien « Valider ma commande » mène à la connexion', async ({
      page,
      context,
      baseURL,
    }) => {
      await fillCart(context, baseURL)
      await page.goto('/panier')
      await page.getByRole('link', { name: 'Valider ma commande' }).click()
      await expectLoginRedirect(page)
    })
  })
})
