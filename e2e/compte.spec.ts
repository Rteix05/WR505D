import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Compte de démonstration public de DummyJSON, donné par le sujet.
const DEMO = { username: 'emilys', password: 'emilyspass' }
const AUTH_COOKIES = ['accessToken', 'refreshToken']

const header = (page: Page) => page.getByRole('banner')

async function login(page: Page): Promise<void> {
  await page.getByLabel("Nom d'utilisateur").fill(DEMO.username)
  await page.getByLabel('Mot de passe').fill(DEMO.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

/** Connexion depuis /compte : passe par la redirection du middleware. */
async function openAccount(page: Page): Promise<void> {
  await page.goto('/compte')
  await login(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Mon compte' })).toBeVisible()
}

async function authCookieNames(page: Page): Promise<string[]> {
  const cookies = await page.context().cookies()
  return cookies.map((cookie) => cookie.name).filter((name) => AUTH_COOKIES.includes(name))
}

test.describe('Page privée /compte', () => {
  test('déconnecté : redirigé vers la connexion, puis ramené sur la page demandée avec sa query', async ({
    page,
  }) => {
    await page.goto('/compte?onglet=commandes')
    await expect(page).toHaveURL(/\/connexion\?redirect=/)
    // vue-router a encodé la cible : on vérifie la valeur décodée, query comprise.
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/compte?onglet=commandes')

    await login(page)
    await expect(page).toHaveURL(/\/compte\?onglet=commandes$/)
    await expect(page.getByRole('main')).toContainText('emily.johnson@x.dummyjson.com')
  })

  test('connecté : lien « Mon compte » de l’en-tête', async ({ page }) => {
    await page.goto('/connexion')
    await login(page)
    await expect(page).toHaveURL(/\/$/)

    await header(page).getByRole('link', { name: 'Mon compte' }).click()
    await expect(page).toHaveURL(/\/compte$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Mon compte' })).toBeVisible()
  })

  test('déconnexion : cookies supprimés, accueil, et « Précédent » ne réaffiche pas le compte', async ({
    page,
  }) => {
    await openAccount(page)
    expect(await authCookieNames(page)).toHaveLength(2)

    await page.getByRole('button', { name: 'Se déconnecter' }).click()

    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
    await expect(header(page).getByRole('link', { name: 'Connexion' })).toBeVisible()
    await expect(header(page).getByRole('link', { name: 'Mon compte' })).toHaveCount(0)
    expect(await authCookieNames(page)).toEqual([])

    // `replace` : /compte a été remplacée dans l'historique par l'accueil, « Précédent »
    // ramène donc à l'étape d'avant (la connexion), pas sur le compte.
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0)

    // Accès direct après déconnexion : de nouveau protégé.
    await page.goto('/compte')
    await expect(page).toHaveURL(/\/connexion\?redirect=/)
  })

  test('au clavier : Entrée sur « Se déconnecter »', async ({ page }) => {
    await openAccount(page)

    await page.getByRole('button', { name: 'Se déconnecter' }).focus()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
    expect(await authCookieNames(page)).toEqual([])
  })

  // /compte n'est pas dans PAGES d'accessibilite.spec.ts : sans session, axe analyserait
  // la page de connexion après la redirection. On la contrôle ici, une fois connecté.
  test('aucune violation d’accessibilité sur /compte', async ({ page }) => {
    await openAccount(page)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const violations = results.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }))
    expect(violations).toEqual([])
  })
})

test.describe('Page privée /compte sans JavaScript (rendu serveur)', () => {
  test.use({ javaScriptEnabled: false })

  test('déconnecté : redirection 302 du serveur, la page privée n’est pas rendue', async ({
    page,
  }) => {
    const response = await page.goto('/compte')
    await expect(page).toHaveURL(/\/connexion\?redirect=/)
    expect(response?.request().redirectedFrom()?.url()).toMatch(/\/compte$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible()
    await expect(page.getByText('Se déconnecter')).toHaveCount(0)
  })
})
