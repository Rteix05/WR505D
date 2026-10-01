import type { ApiRequestOptions, DummyJsonApi } from '~/utils/dummyjsonApi'

/**
 * Client des routes publiques de DummyJSON (catalogue, fiche produit, catégories).
 * Pas de $authFetch ici : sans jeton, il considère la session expirée, alors qu'un
 * visiteur non connecté doit pouvoir parcourir le catalogue.
 */
export function useApi(): DummyJsonApi {
  const config = useRuntimeConfig()
  return createDummyJsonApi(<T>(url: string, options: ApiRequestOptions = {}) =>
    $fetch<T>(url, { ...options, baseURL: config.public.apiBase }),
  )
}
