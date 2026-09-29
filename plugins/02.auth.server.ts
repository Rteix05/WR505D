// Côté serveur uniquement : l'utilisateur est chargé avant le rendu de la page.
// Le store Pinia est ensuite transmis au navigateur avec le HTML, donc la page
// s'affiche directement dans l'état connecté, sans « flash » de l'état déconnecté.
export default defineNuxtPlugin({
  name: 'auth',
  async setup() {
    await useAuth().loadUser()
  },
})
