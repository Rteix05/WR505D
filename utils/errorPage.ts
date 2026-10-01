/**
 * Titre de la page d'erreur. On ne réutilise jamais `statusMessage` : pour une route
 * inconnue, c'est Nuxt qui le remplit, en anglais (« Page not found: /nexiste-pas »).
 * Une page peut donner son propre titre en français via `createError({ data: { title } })`.
 * `data` est `unknown` (n'importe quelle erreur peut arriver ici) : vérifié avant usage.
 */
export function errorPageTitle(statusCode: number | undefined, data: unknown): string {
  if (statusCode !== 404) return 'Une erreur est survenue'
  const title = titleFrom(parseData(data))
  return title ?? 'Page introuvable'
}

/**
 * Erreur levée pendant le rendu serveur : Nuxt transmet `data` à error.vue sous forme
 * de texte JSON (`'{"title":"…"}'`), pas d'objet. Côté client, c'est l'objet d'origine.
 */
function parseData(data: unknown): unknown {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

function titleFrom(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('title' in data)) return null
  const { title } = data
  return typeof title === 'string' && title.trim() !== '' ? title : null
}
