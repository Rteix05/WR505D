import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// Barème : « parcours clavier du tunnel sans blocage ». Ce parcours n'utilise JAMAIS la souris
// ni de clic simulé : seulement Tab, Entrée, les flèches et la saisie, comme une personne
// qui navigue au clavier. Si un élément du tunnel n'est pas atteignable, le test échoue.

/** Attend que Vue ait hydraté la page (avant, les boutons ne réagissent pas encore). */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: unknown }) | null
    return root?.__vue_app__ !== undefined
  })
}

/**
 * Appuie sur Tab jusqu'à ce que `target` ait le focus. Échoue si `maxPresses` ne suffisent pas :
 * l'élément n'est pas atteignable au clavier (ou l'ordre de tabulation est aberrant).
 */
async function tabTo(page: Page, target: Locator, maxPresses = 60): Promise<void> {
  for (let presses = 0; presses < maxPresses; presses++) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  const reached = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))
  throw new Error(`Élément non atteint en ${maxPresses} tabulations. Focus actuel : ${reached}`)
}

test('tunnel d’achat complet au clavier seul : accueil → tri → fiche → panier → code promo', async ({
  page,
}) => {
  // 1. Accueil : la première tabulation atteint le lien d'évitement.
  await page.goto('/')
  await waitForHydration(page)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused()

  // 2. Menu « Produits ».
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await tabTo(page, nav.getByRole('link', { name: 'Produits' }))
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/produits$/)
  await waitForHydration(page)

  // 3. Tri « Prix décroissant » avec les flèches du menu, puis « Appliquer ».
  const sort = page.getByLabel('Trier par')
  await tabTo(page, sort)
  await page.keyboard.press('ArrowDown') // Prix croissant
  await page.keyboard.press('ArrowDown') // Prix décroissant
  await expect(sort).toHaveValue('price-desc')
  await expect(page).toHaveURL(/\/produits$/) // rien ne change avant « Appliquer »
  await tabTo(page, page.getByRole('button', { name: 'Appliquer' }))
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/sortBy=price&order=desc/)

  // 4. Premier produit (le plus cher), ouvert avec Entrée.
  const firstProduct = page.getByRole('main').getByRole('article').first().getByRole('link')
  const productName = (await firstProduct.textContent())?.trim() ?? ''
  await tabTo(page, firstProduct)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/produits\/\d+$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(productName)
  await waitForHydration(page)

  // 5. « Ajouter au panier », confirmation annoncée.
  await tabTo(page, page.getByRole('button', { name: 'Ajouter au panier' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main').getByRole('status').first()).toContainText(
    'a été ajouté au panier',
  )

  // 6. « Voir le panier ».
  await tabTo(page, page.getByRole('link', { name: 'Voir le panier' }))
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/panier$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Mon panier' })).toBeVisible()
  await waitForHydration(page)

  // 7. Quantité : « + » au clavier, 1 → 2.
  await tabTo(page, page.getByRole('button', { name: `Ajouter un exemplaire de ${productName}` }))
  await page.keyboard.press('Enter')
  await expect(page.getByLabel(`Quantité de ${productName}`)).toHaveValue('2')

  // 8. Code promo saisi au clavier, validé avec Entrée.
  await tabTo(page, page.getByLabel('Code promo'))
  await page.keyboard.type('troyes10')
  await page.keyboard.press('Enter')

  // 9. Récapitulatif : code appliqué (-10,00 €), livraison offerte (panier > 80 €).
  const summary = page.getByRole('main')
  await expect(summary.getByText('Code TROYES10', { exact: false }).first()).toBeVisible()
  await expect(summary).toContainText('-10,00 €')
  await expect(summary).toContainText('Offerte')

  // 10. Le panier rempli, remises affichées, n'est vérifié par axe-core qu'ici : `PAGES` de
  // `accessibilite.spec.ts` ne voit que le panier vide.
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations.map((violation) => violation.id)).toEqual([])
})
