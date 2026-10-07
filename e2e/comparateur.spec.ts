import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

const FULL_MESSAGE = 'Comparateur plein : retirez un produit pour en ajouter un autre'

const cards = (page: Page) => page.getByRole('main').getByRole('article')
const bar = (page: Page) => page.getByRole('complementary', { name: 'Comparateur de produits' })
const barLink = (page: Page) => bar(page).getByRole('link', { name: /^Comparer \(\d\/3\)$/ })
const barItems = (page: Page) => bar(page).getByRole('listitem')
// Zone `aria-live` du comparateur (sans role="status" : le catalogue a déjà la sienne).
// Nuxt en a aussi une pour les changements de page : on filtre par texte.
const announced = (page: Page, text: string) =>
  page.locator('[aria-live="polite"]').filter({ hasText: text })

/** Bouton « Comparer » de la n-ième carte du catalogue. */
const toggleOf = (page: Page, index: number): Locator =>
  cards(page)
    .nth(index)
    .getByRole('button', { name: /^Comparer / })

/**
 * Le HTML du serveur est affiché avant que les boutons réagissent : cliquer trop tôt ne
 * fait rien. On attend que l'application Vue soit montée (même garde que comparer.spec.ts).
 */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: unknown }) | null
    return root?.__vue_app__ !== undefined
  })
}

async function openCatalogue(page: Page): Promise<void> {
  await page.goto('/produits')
  await expect(cards(page)).toHaveCount(12)
  await waitForHydration(page)
}

/** Valeur décodée du cookie `compare`, ou `null` s'il n'existe pas. */
async function compareCookie(page: Page): Promise<string | null> {
  const cookie = (await page.context().cookies()).find((item) => item.name === 'compare')
  return cookie ? decodeURIComponent(cookie.value) : null
}

test.describe('Comparateur : sélection', () => {
  test('ajout puis retrait : bouton bascule, barre, annonce et cookie en identifiants', async ({
    page,
  }) => {
    await openCatalogue(page)
    await expect(bar(page)).toHaveCount(0)
    await expect(toggleOf(page, 0)).toHaveAttribute('aria-pressed', 'false')

    await toggleOf(page, 0).click()
    await toggleOf(page, 1).click()

    await expect(toggleOf(page, 0)).toHaveAttribute('aria-pressed', 'true')
    await expect(toggleOf(page, 1)).toHaveAttribute('aria-pressed', 'true')
    await expect(toggleOf(page, 2)).toHaveAttribute('aria-pressed', 'false')
    await expect(barLink(page)).toBeVisible()
    await expect(barLink(page)).toHaveText('Comparer (2/3)')
    await expect(barItems(page)).toHaveCount(2)
    await expect(announced(page, 'ajouté au comparateur (2/3).')).toHaveCount(1)
    // Identifiants uniquement : pas de titre ni d'URL d'image dans le cookie.
    expect(await compareCookie(page)).toMatch(/^\d+,\d+$/)

    // Retrait depuis la barre : la carte repasse en « non pressé ».
    await bar(page)
      .getByRole('button', { name: /^Retirer .* du comparateur$/ })
      .first()
      .click()
    await expect(toggleOf(page, 0)).toHaveAttribute('aria-pressed', 'false')
    await expect(barLink(page)).toHaveText('Comparer (1/3)')
    await expect(announced(page, 'retiré du comparateur (1/3).')).toHaveCount(1)

    // Retrait depuis la carte : le dernier produit retiré, la barre et le cookie disparaissent.
    await toggleOf(page, 1).click()
    await expect(bar(page)).toHaveCount(0)
    expect(await compareCookie(page)).toBeNull()
  })

  test('4ᵉ produit : rien n’est ajouté et le refus est annoncé', async ({ page }) => {
    await openCatalogue(page)
    for (const index of [0, 1, 2]) await toggleOf(page, index).click()
    await expect(barLink(page)).toHaveText('Comparer (3/3)')

    await toggleOf(page, 3).click()

    await expect(announced(page, FULL_MESSAGE)).toHaveCount(1)
    await expect(toggleOf(page, 3)).toHaveAttribute('aria-pressed', 'false')
    await expect(barItems(page)).toHaveCount(3)
    await expect(barLink(page)).toHaveText('Comparer (3/3)')
    // Le bouton n'est pas désactivé : un bouton désactivé n'annoncerait rien.
    await expect(toggleOf(page, 3)).toBeEnabled()

    // Retirer un produit libère une place.
    await toggleOf(page, 0).click()
    await toggleOf(page, 3).click()
    await expect(toggleOf(page, 3)).toHaveAttribute('aria-pressed', 'true')
    await expect(barItems(page)).toHaveCount(3)
  })

  test('persistance : la sélection et la barre sont encore là après un rechargement', async ({
    page,
  }) => {
    await openCatalogue(page)
    await toggleOf(page, 0).click()
    await toggleOf(page, 1).click()
    await expect(barItems(page)).toHaveCount(2)

    await page.reload()
    await expect(cards(page)).toHaveCount(12)

    await expect(toggleOf(page, 0)).toHaveAttribute('aria-pressed', 'true')
    await expect(toggleOf(page, 1)).toHaveAttribute('aria-pressed', 'true')
    await expect(barLink(page)).toHaveText('Comparer (2/3)')
    await expect(barLink(page)).toHaveAttribute('href', /^\/comparer\?ids=\d+,\d+$/)
    // Titres et miniatures rechargés depuis l'API (le cookie n'a que les identifiants).
    await expect(barItems(page).first().locator('img')).toHaveAttribute('src', /^https:\/\//)
    await expect(barItems(page).first()).not.toContainText('Produit n°')
  })

  test('après un rechargement : titres transmis au navigateur, aucun appel API refait', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'compare', value: '1%2C2', url: baseURL ?? '' }])
    // Seuls comptent les appels faits PAR LE NAVIGATEUR : ceux du serveur sont invisibles ici.
    // Suite à la review de #62 : `known` n'était pas dans l'état Pinia transmis, donc le
    // navigateur ne connaissait aucun titre et refaisait les appels déjà faits par le serveur.
    const browserCalls: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('dummyjson.com/products/')) browserCalls.push(request.url())
    })

    await page.goto('/produits')
    await waitForHydration(page)
    await page.waitForLoadState('networkidle')

    await expect(barItems(page)).toHaveCount(2)
    await expect(bar(page)).not.toContainText('Produit n°')
    await expect(barItems(page).first().locator('img')).toHaveAttribute('src', /^https:\/\//)
    expect(browserCalls).toEqual([])
  })

  test('la sélection suit la navigation : fiche produit, puis catalogue, puis /comparer', async ({
    page,
  }) => {
    await page.goto('/produits/1')
    await waitForHydration(page)
    const toggle = page.getByRole('main').getByRole('button', { name: /^Comparer / })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(barLink(page)).toHaveText('Comparer (1/3)')

    // Navigation côté client : la barre reste affichée, la carte correspondante est « pressée ».
    await page.getByRole('link', { name: 'Produits', exact: true }).first().click()
    await expect(cards(page)).toHaveCount(12)
    await expect(barLink(page)).toHaveText('Comparer (1/3)')
    await expect(toggleOf(page, 0)).toHaveAttribute('aria-pressed', 'true')

    await toggleOf(page, 1).click()
    await barLink(page).click()
    await expect(page).toHaveURL(/\/comparer\?ids=1,2$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Comparer des produits' }),
    ).toBeVisible()
  })
})

test.describe('Comparateur : clavier', () => {
  test('Entrée sur « Comparer », puis retrait au clavier : le focus reste dans la barre', async ({
    page,
  }) => {
    await openCatalogue(page)
    await toggleOf(page, 0).focus()
    await page.keyboard.press('Enter')
    await toggleOf(page, 1).focus()
    await page.keyboard.press('Space')
    await expect(barItems(page)).toHaveCount(2)

    const removes = bar(page).getByRole('button', { name: /^Retirer / })
    await removes.first().focus()
    await page.keyboard.press('Enter')

    await expect(barItems(page)).toHaveCount(1)
    // Le bouton cliqué a disparu : le focus passe au suivant, pas à la page.
    await expect(bar(page).getByRole('button', { name: /^Retirer / })).toBeFocused()
  })
})

test.describe('Comparateur : cookie', () => {
  test('cookie corrompu ou modifié à la main : ignoré, la page s’affiche normalement', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'compare', value: 'abc%2C%2C-5%2C1.5', url: baseURL ?? '' }])
    const response = await page.goto('/produits')
    expect(response?.status()).toBe(200)
    await expect(cards(page)).toHaveCount(12)
    await expect(bar(page)).toHaveCount(0)
    await expect(toggleOf(page, 0)).toHaveAttribute('aria-pressed', 'false')
  })

  test('identifiant sans produit (9999) : retiré, les autres gardés', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'compare', value: '1%2C9999', url: baseURL ?? '' }])
    await page.goto('/produits')
    await expect(cards(page)).toHaveCount(12)

    await expect(barItems(page)).toHaveCount(1)
    await expect(barLink(page)).toHaveText('Comparer (1/3)')
    await expect(toggleOf(page, 0)).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('Comparateur sans JavaScript (rendu serveur)', () => {
  test.use({ javaScriptEnabled: false })

  test('la sélection du cookie est déjà dans le HTML : boutons pressés et barre', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'compare', value: '1%2C2', url: baseURL ?? '' }])
    await page.goto('/produits')

    await expect(toggleOf(page, 0)).toHaveAttribute('aria-pressed', 'true')
    await expect(toggleOf(page, 1)).toHaveAttribute('aria-pressed', 'true')
    await expect(toggleOf(page, 2)).toHaveAttribute('aria-pressed', 'false')
    await expect(barLink(page)).toHaveText('Comparer (2/3)')
    await expect(barLink(page)).toHaveAttribute('href', '/comparer?ids=1,2')
    // Miniatures et titres chargés côté serveur : aucun repli « Produit n° ».
    await expect(barItems(page)).toHaveCount(2)
    await expect(bar(page)).not.toContainText('Produit n°')
    await expect(barItems(page).first().locator('img')).toHaveAttribute('src', /^https:\/\//)
  })
})

test.describe('Comparateur : accessibilité', () => {
  test('aucune violation axe avec des produits sélectionnés et la barre affichée', async ({
    page,
  }) => {
    // Mouvement réduit : le bouton change de couleur sans fondu. Sinon axe pourrait analyser
    // la page en plein fondu de 150 ms, avec une couleur intermédiaire qui n'existe plus ensuite.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openCatalogue(page)
    await toggleOf(page, 0).click()
    await toggleOf(page, 1).click()
    await expect(barItems(page)).toHaveCount(2)

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
