export interface Debounced<A extends unknown[]> {
  (...args: A): void
  /** Abandonne l'appel en attente (ex. composant démonté). */
  cancel: () => void
  /** Exécute tout de suite l'appel en attente (ex. Entrée dans le champ de recherche). */
  flush: () => void
  /** Un appel attend-il la fin du délai ? */
  pending: () => boolean
}

/**
 * Retarde `fn` jusqu'à `delay` ms sans nouvel appel : seul le dernier appel part,
 * avec ses arguments. Taper « phone » en 300 ms donne 1 requête au lieu de 5.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: A | undefined

  function run(): void {
    const args = lastArgs
    timer = undefined
    lastArgs = undefined
    if (args) fn(...args)
  }

  const debounced = (...args: A): void => {
    lastArgs = args
    clearTimeout(timer)
    timer = setTimeout(run, delay)
  }

  debounced.cancel = (): void => {
    clearTimeout(timer)
    timer = undefined
    lastArgs = undefined
  }

  debounced.flush = (): void => {
    if (timer === undefined) return
    clearTimeout(timer)
    run()
  }

  debounced.pending = (): boolean => timer !== undefined

  return debounced
}
