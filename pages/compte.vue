<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

import { storeToRefs } from 'pinia'

// Une seule déconnexion dans l'application : celle du store auth (#34).
const auth = useAuthStore()
const { user } = storeToRefs(auth)

useSeoMeta({
  title: 'Mon compte',
  description: 'Les informations de votre compte ChampaShop.',
  robots: 'noindex, nofollow',
})
</script>

<template>
  <section class="account" aria-labelledby="account-title">
    <h1 id="account-title">Mon compte</h1>

    <!-- v-if : pendant la déconnexion, le store est vidé juste avant la navigation vers l'accueil. -->
    <template v-if="user">
      <div class="account__profile">
        <!-- alt vide : l'image est décorative, le nom est écrit juste à côté. -->
        <img :src="user.image" alt="" width="96" height="96" class="account__avatar" />
        <dl class="account__details">
          <div>
            <dt>Nom</dt>
            <dd>{{ user.firstName }} {{ user.lastName }}</dd>
          </div>
          <div>
            <dt>Nom d'utilisateur</dt>
            <dd>{{ user.username }}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{{ user.email }}</dd>
          </div>
        </dl>
      </div>

      <button type="button" class="account__logout" @click="auth.logout()">Se déconnecter</button>
    </template>
  </section>
</template>

<style scoped>
.account {
  max-width: 32rem;
  margin: 0 auto;
}
.account__profile {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: center;
  margin-bottom: 1.5rem;
}
.account__avatar {
  border-radius: 50%;
  background: #f3f4f6;
}
.account__details {
  margin: 0;
  display: grid;
  gap: 0.75rem;
}
.account__details dt {
  font-size: 0.875rem;
  color: #4b5563;
}
.account__details dd {
  margin: 0;
  font-weight: 600;
}
.account__logout {
  padding: 0.625rem 1rem;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: #1f2937;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}
:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
</style>
