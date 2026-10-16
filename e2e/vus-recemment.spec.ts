import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Produits de l'API de démonstration DummyJSON (données fixes) : 1, 2 et 3 sont des cosmétiques.
const TITLES: Record<number, string> = {
  1: 'Essence Mascara Lash Princess',
  2: 'Eyeshadow Palette with Mirror',
  3: 'Powder Canister',
}

const section = (page: Page) => page.getByRole('region', { name: 'Produits vus récemment' })
const cards = (page: Page) => section(page).getByRole('article')
const clearButton = (page: Page) => page.getByRole('button', { name: "Effacer l'historique" })
// Zone `aria-live` du composant (sans role="status" : le catalogue a déjà la sienne).
const announced = (page: Page, text: string) =>
  page.locator('[aria-live="polite"]').filter({ hasText: text })

/** Titres des cartes de l'historique, dans l'ordre affiché. */
async function shownTitles(page: Page): Promise<string[]> {
  return (await section(page).getByRole('heading', { level: 3 }).allTextContents()).map((title) =>
    title.trim(),
  )
}

/** Valeur décodée du cookie `recently_viewed`, ou `null` s'il n'existe pas. */
async function historyCookie(page: Page): Promise<string | null> {
  const cookie = (await page.context().cookies()).find((item) => item.name === 'recently_viewed')
  return cookie ? decodeURIComponent(cookie.value) : null
}

/** Cookie déjà présent avant la première visite (ancien, ou modifié à la main). */
async function seed(page: Page, baseURL: string | undefined, value: string): Promise<void> {
  await page.context().addCookies([{ name: 'recently_viewed', value, url: baseURL ?? '' }])
}

/** Le HTML du serveur est affiché avant que les boutons réagissent (même garde que comparer.spec.ts). */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: unknown }) | null
    return root?.__vue_app__ !== undefined
  })
}

async function visit(page: Page, id: number): Promise<void> {
  const response = await page.goto(`/produits/${id}`)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: TITLES[id] })).toBeVisible()
}

test.describe('Produits vus récemment', () => {
  test('chaque fiche visitée passe en tête, sur l’accueil, avec un cookie en identifiants', async ({
    page,
  }) => {
    for (const id of [1, 2, 3]) await visit(page, id)

    await page.goto('/')
    await expect(cards(page)).toHaveCount(3)
    expect(await shownTitles(page)).toEqual([TITLES[3], TITLES[2], TITLES[1]])
    // Hiérarchie de titres juste : h2 de la section, h3 des cartes.
    await expect(section(page).getByRole('heading', { level: 2 })).toHaveText(
      'Produits vus récemment',
    )
    // Identifiants uniquement : pas de titre, de prix ni d'image dans le cookie.
    expect(await historyCookie(page)).toBe('3,2,1')
  })

  test('revisite : le produit remonte en tête, sans doublon', async ({ page }) => {
    for (const id of [1, 2, 3, 1]) await visit(page, id)
    await page.goto('/')
    expect(await shownTitles(page)).toEqual([TITLES[1], TITLES[3], TITLES[2]])
    expect(await historyCookie(page)).toBe('1,3,2')
  })

  test('en bas de la fiche : l’historique, sans le produit courant', async ({ page }) => {
    for (const id of [1, 2, 3]) await visit(page, id)

    // On est sur la fiche 3 : sa propre liste ne la contient pas.
    await expect(cards(page)).toHaveCount(2)
    expect(await shownTitles(page)).toEqual([TITLES[2], TITLES[1]])

    await visit(page, 2)
    expect(await shownTitles(page)).toEqual([TITLES[3], TITLES[1]])
    expect(await historyCookie(page)).toBe('2,3,1')
  })

  test('première visite : aucune section, pas de cookie', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(section(page)).toHaveCount(0)
    expect(await historyCookie(page)).toBeNull()
  })

  test('une 404 n’ajoute rien : produit inexistant ou identifiant invalide', async ({ page }) => {
    for (const path of ['/produits/99999', '/produits/abc']) {
      const response = await page.goto(path)
      expect(response?.status()).toBe(404)
    }
    expect(await historyCookie(page)).toBeNull()

    await visit(page, 1)
    expect(await historyCookie(page)).toBe('1')
  })

  test('10 produits maximum : au 11ᵉ, le plus ancien sort', async ({ page }) => {
    for (let id = 1; id <= 11; id++) {
      const response = await page.goto(`/produits/${id}`)
      expect(response?.status()).toBe(200)
    }
    expect((await historyCookie(page))?.split(',')).toEqual([
      '11',
      '10',
      '9',
      '8',
      '7',
      '6',
      '5',
      '4',
      '3',
      '2',
    ])
  })
})

test.describe('Produits vus récemment : effacer', () => {
  test('« Effacer l’historique » : annoncé, focus sur le titre, cookie supprimé', async ({
    page,
    baseURL,
  }) => {
    await seed(page, baseURL, '2%2C1')
    await page.goto('/')
    await expect(cards(page)).toHaveCount(2)
    await waitForHydration(page)

    await clearButton(page).click()

    await expect(announced(page, 'Historique effacé.')).toHaveCount(1)
    await expect(cards(page)).toHaveCount(0)
    await expect(section(page).getByText('Votre historique a été effacé.')).toBeVisible()
    // Le bouton cliqué a disparu : le focus passe au titre de la section, pas en haut de page.
    await expect(section(page).getByRole('heading', { level: 2 })).toBeFocused()
    expect(await historyCookie(page)).toBeNull()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(section(page)).toHaveCount(0)
  })

  test('au clavier : Entrée sur « Effacer l’historique »', async ({ page, baseURL }) => {
    await seed(page, baseURL, '2%2C1')
    await page.goto('/')
    await waitForHydration(page)

    await clearButton(page).focus()
    await page.keyboard.press('Enter')

    await expect(section(page).getByText('Votre historique a été effacé.')).toBeVisible()
    expect(await historyCookie(page)).toBeNull()
  })
})

test.describe('Produits vus récemment : cookie corrompu', () => {
  test('texte illisible : ignoré et supprimé, la page s’affiche normalement', async ({
    page,
    baseURL,
  }) => {
    await seed(page, baseURL, 'abc%2C%2C-5%2C1.5')
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(section(page)).toHaveCount(0)
    // Réinitialisé : plus de valeur corrompue renvoyée à chaque visite.
    expect(await historyCookie(page)).toBeNull()
  })

  test('encodage cassé (%E0%A4%A) : jamais d’erreur 500', async ({ page, baseURL }) => {
    await seed(page, baseURL, '%E0%A4%A')
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(section(page)).toHaveCount(0)
  })

  test('identifiants valides gardés, invalides et sans produit retirés, cookie réécrit', async ({
    page,
    baseURL,
  }) => {
    await seed(page, baseURL, '2%2Cabc%2C2%2C9999')
    await page.goto('/')

    await expect(cards(page)).toHaveCount(1)
    expect(await shownTitles(page)).toEqual([TITLES[2]])
    expect(await historyCookie(page)).toBe('2')
  })
})

test.describe('Produits vus récemment : appels du navigateur', () => {
  // Seuls comptent les appels faits PAR LE NAVIGATEUR : ceux du serveur lui sont invisibles.
  function watchApiCalls(page: Page): string[] {
    const calls: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('dummyjson.com/products/')) calls.push(request.url())
    })
    return calls
  }

  test('après un rechargement : produits transmis au navigateur, aucun appel refait', async ({
    page,
    baseURL,
  }) => {
    await seed(page, baseURL, '2%2C1')
    const calls = watchApiCalls(page)

    await page.goto('/')
    await waitForHydration(page)
    await page.waitForLoadState('networkidle')

    await expect(cards(page)).toHaveCount(2)
    expect(await shownTitles(page)).toEqual([TITLES[2], TITLES[1]])
    expect(calls).toEqual([])
  })

  test('de la fiche à l’accueil : le produit visité est déjà connu, rien à recharger', async ({
    page,
  }) => {
    await visit(page, 1)
    await waitForHydration(page)
    const calls = watchApiCalls(page)

    await page.getByRole('link', { name: 'Accueil', exact: true }).first().click()

    await expect(cards(page)).toHaveCount(1)
    expect(await shownTitles(page)).toEqual([TITLES[1]])
    await page.waitForLoadState('networkidle')
    expect(calls).toEqual([])
  })
})

test.describe('Produits vus récemment sans JavaScript (rendu serveur)', () => {
  test.use({ javaScriptEnabled: false })

  test('la liste est déjà dans le HTML, dans l’ordre, sans bouton inutilisable', async ({
    page,
    baseURL,
  }) => {
    await seed(page, baseURL, '2%2C1')
    await page.goto('/')

    await expect(cards(page)).toHaveCount(2)
    expect(await shownTitles(page)).toEqual([TITLES[2], TITLES[1]])
    await expect(cards(page).first().locator('img')).toHaveAttribute('src', /^https:\/\//)
    // « Effacer » a besoin de JavaScript : sans lui, il n'est pas affiché plutôt que de ne rien faire.
    await expect(clearButton(page)).toHaveCount(0)
  })

  test('une visite de fiche est enregistrée par le serveur', async ({ page }) => {
    await visit(page, 3)
    expect(await historyCookie(page)).toBe('3')
  })
})

test.describe('Produits vus récemment : accessibilité', () => {
  for (const [name, path] of [
    ['accueil', '/'],
    ['fiche produit', '/produits/3'],
  ] as const) {
    test(`aucune violation axe sur ${name} avec un historique`, async ({ page, baseURL }) => {
      // Mouvement réduit : pas de fondu de bouton en cours pendant l'analyse (voir comparateur.spec.ts).
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await seed(page, baseURL, '2%2C1')
      await page.goto(path)
      await expect(cards(page).first()).toBeVisible()
      await waitForHydration(page)

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
  }
})
