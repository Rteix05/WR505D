// Pages privées : `definePageMeta({ middleware: 'auth' })`.
// Côté serveur, le plugin 02.auth.server a déjà chargé l'utilisateur (jeton rafraîchi si besoin)
// avant les middlewares de route : le store est fiable dès le premier rendu, et un visiteur
// déconnecté reçoit une redirection 302 sans que la page privée soit rendue.
export default defineNuxtRouteMiddleware((to) => {
  if (useUserStore().isLoggedIn) return
  return navigateTo(loginRedirectLocation(to.fullPath))
})
