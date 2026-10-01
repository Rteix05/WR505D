<script setup lang="ts">
const route = useRoute()
const auth = useAuthStore()

useSeoMeta({
  title: 'Connexion',
  description: 'Connectez-vous à votre compte ChampaShop.',
  robots: 'noindex, nofollow',
})

const redirectTo = computed((): string => safeRedirect(route.query.redirect))

// Déjà connecté : inutile d'afficher le formulaire.
if (auth.isAuthenticated) {
  await navigateTo(redirectTo.value, { replace: true })
}

// Pré-rempli avec le nom de la dernière connexion (cookie `auth`, lu dès le rendu serveur).
const username = ref(auth.rememberedUsername)
const password = ref('')
const usernameError = ref('')
const passwordError = ref('')
const formError = ref('')
const pending = ref(false)

const usernameInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)

/** Vérifie les champs obligatoires et place le focus sur le premier champ en erreur. */
function validate(): boolean {
  usernameError.value = username.value.trim() === '' ? "Saisissez votre nom d'utilisateur." : ''
  passwordError.value = password.value === '' ? 'Saisissez votre mot de passe.' : ''
  if (usernameError.value) usernameInput.value?.focus()
  else if (passwordError.value) passwordInput.value?.focus()
  return !usernameError.value && !passwordError.value
}

async function onSubmit(): Promise<void> {
  formError.value = ''
  if (!validate() || pending.value) return

  pending.value = true
  try {
    await auth.login({ username: username.value.trim(), password: password.value })
    await navigateTo(redirectTo.value)
  } catch (error) {
    formError.value = loginErrorMessage(error)
    password.value = ''
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="login" aria-labelledby="login-title">
    <h1 id="login-title">Connexion</h1>

    <p class="login__demo">
      Compte de démonstration : <strong>emilys</strong> / <strong>emilyspass</strong>
    </p>

    <!-- Toujours présente (même vide) : un lecteur d'écran n'annonce une zone role="alert" que si elle existait déjà. -->
    <p class="login__alert" :class="{ 'login__alert--visible': formError }" role="alert">
      {{ formError }}
    </p>

    <form class="login__form" novalidate @submit.prevent="onSubmit">
      <div class="login__field">
        <label for="username">Nom d'utilisateur</label>
        <input
          id="username"
          ref="usernameInput"
          v-model="username"
          name="username"
          type="text"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          required
          :aria-invalid="usernameError ? 'true' : undefined"
          :aria-describedby="usernameError ? 'username-error' : undefined"
        />
        <p v-if="usernameError" id="username-error" class="login__error">{{ usernameError }}</p>
      </div>

      <div class="login__field">
        <label for="password">Mot de passe</label>
        <input
          id="password"
          ref="passwordInput"
          v-model="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
          :aria-invalid="passwordError ? 'true' : undefined"
          :aria-describedby="passwordError ? 'password-error' : undefined"
        />
        <p v-if="passwordError" id="password-error" class="login__error">{{ passwordError }}</p>
      </div>

      <button type="submit" class="login__submit" :disabled="pending" :aria-busy="pending">
        {{ pending ? 'Connexion en cours…' : 'Se connecter' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.login {
  max-width: 24rem;
  margin: 0 auto;
}
.login__demo {
  padding: 0.75rem 1rem;
  background: #f3f4f6;
  border-radius: 0.375rem;
}
.login__alert {
  margin: 0;
}
.login__alert--visible {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid #b91c1c;
  border-radius: 0.375rem;
  color: #b91c1c;
}
.login__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.login__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.login__field input {
  padding: 0.5rem 0.75rem;
  font: inherit;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
}
.login__field input[aria-invalid='true'] {
  border-color: #b91c1c;
}
.login__error {
  margin: 0;
  color: #b91c1c;
  font-size: 0.875rem;
}
.login__submit {
  padding: 0.625rem 1rem;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: #1f2937;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}
.login__submit:disabled {
  opacity: 0.7;
  cursor: wait;
}
:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
</style>
