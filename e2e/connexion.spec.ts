import { expect, test, type Page } from '@playwright/test'

// Compte de démonstration public de DummyJSON, donné par le sujet.
const DEMO = { username: 'emilys', password: 'emilyspass' }

const header = (page: Page) => page.getByRole('banner')

async function login(page: Page, username: string, password: string): Promise<void> {
  await page.getByLabel("Nom d'utilisateur").fill(username)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

test.describe('Connexion /connexion', () => {
  test('formulaire vide : erreurs sous les champs, focus sur le premier', async ({ page }) => {
    await page.goto('/connexion')
    await page.getByRole('button', { name: 'Se connecter' }).click()

    const username = page.getByLabel("Nom d'utilisateur")
    await expect(username).toBeFocused()
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    await expect(username).toHaveAccessibleDescription("Saisissez votre nom d'utilisateur.")
    await expect(page.getByLabel('Mot de passe')).toHaveAccessibleDescription(
      'Saisissez votre mot de passe.',
    )
  })

  test('mauvais mot de passe : message annoncé, mot de passe vidé', async ({ page }) => {
    await page.goto('/connexion')
    await login(page, DEMO.username, 'mauvais-mot-de-passe')

    // Scopé au <main> : Nuxt a aussi une zone role="alert" qui annonce les changements de page.
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      'Identifiant ou mot de passe incorrect.',
    )
    await expect(page.getByLabel('Mot de passe')).toHaveValue('')
    await expect(page).toHaveURL(/\/connexion$/)
  })

  test('connexion réussie, puis rechargement sans flash de l’état déconnecté', async ({
    page,
    browser,
  }) => {
    await page.goto('/connexion')
    await login(page, DEMO.username, DEMO.password)

    await expect(page).toHaveURL(/\/$/)
    await expect(header(page)).toContainText('Bonjour, Emily')

    // Même cookies, JavaScript désactivé : seul le HTML du serveur compte. S'il contient
    // déjà « Bonjour, Emily », il n'y a pas de flash « Connexion » au rechargement.
    const noJs = await browser.newContext({
      storageState: await page.context().storageState(),
      javaScriptEnabled: false,
    })
    const ssrPage = await noJs.newPage()
    await ssrPage.goto('/')
    await expect(header(ssrPage)).toContainText('Bonjour, Emily')
    await expect(header(ssrPage).getByRole('link', { name: 'Connexion' })).toHaveCount(0)
    await noJs.close()
  })

  test('?redirect= : renvoie vers la page demandée après connexion', async ({ page }) => {
    await page.goto('/connexion?redirect=/produits?page=2')
    await login(page, DEMO.username, DEMO.password)
    await expect(page).toHaveURL(/\/produits\?page=2$/)
  })

  test('?redirect= vers un autre site : ignoré, retour à l’accueil', async ({ page }) => {
    await page.goto('/connexion?redirect=//evil.example')
    await login(page, DEMO.username, DEMO.password)
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  })
})
