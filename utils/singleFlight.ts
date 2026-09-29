/**
 * « Single-flight » : tant qu'une exécution de `task` est en cours, les appels
 * suivants reçoivent la même promesse au lieu d'en lancer une nouvelle.
 * Une fois la promesse terminée (succès ou échec), l'appel suivant relance `task`.
 */
export function createSingleFlight<T>(task: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null

  return () => {
    inFlight ??= task().finally(() => {
      inFlight = null
    })
    return inFlight
  }
}
