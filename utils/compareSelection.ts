import { COMPARE_MAX } from './compare'

/** Message annoncé (`aria-live`) quand le comparateur est plein : texte imposé par l'issue #46. */
export const COMPARE_FULL_MESSAGE =
  'Comparateur plein : retirez un produit pour en ajouter un autre'

/** Libellé de la barre : « Comparer (2/3) ». */
export function compareBarLabel(count: number, max = COMPARE_MAX): string {
  return `Comparer (${count}/${max})`
}

/**
 * Phrase annoncée après un clic sur « Comparer » ou sur le retrait d'un produit.
 * Un produit refusé (comparateur plein) n'a pas été ajouté : seul le message « plein » est annoncé.
 */
export function compareToggleMessage(
  title: string,
  outcome: { added: boolean; rejected: boolean },
  count: number,
  max = COMPARE_MAX,
): string {
  if (outcome.rejected) return COMPARE_FULL_MESSAGE
  const action = outcome.added ? 'ajouté au' : 'retiré du'
  return `« ${title} » ${action} comparateur (${count}/${max}).`
}

/** Nom accessible du bouton bascule : contient le texte visible « Comparer » (WCAG 2.5.3). */
export function compareButtonName(title: string): string {
  return `Comparer ${title}`
}

/** Nom accessible du bouton de retrait d'une miniature de la barre. */
export function compareRemoveName(title: string): string {
  return `Retirer ${title} du comparateur`
}

/** Lien de la barre vers la page de comparaison, ou `null` s'il n'y a rien à comparer. */
export function compareLink(ids: number[]): string | null {
  return ids.length > 0 ? `/comparer?ids=${ids.join(',')}` : null
}
