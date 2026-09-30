<script setup lang="ts">
const props = defineProps<{
  /** Code enregistré dans le panier ('' si aucun). */
  code: string
  /** Vrai si le code donne réellement une remise. */
  accepted: boolean
  /** Explications de computeCart : code inconnu, refusé ou plafonné. */
  messages: string[]
}>()

const emit = defineEmits<{
  apply: [code: string]
  clear: []
}>()

const draft = ref(props.code)
const refused = computed((): boolean => props.code !== '' && !props.accepted)

function onSubmit(): void {
  emit('apply', draft.value)
}

function onClear(): void {
  draft.value = ''
  emit('clear')
}
</script>

<template>
  <form class="promo" novalidate @submit.prevent="onSubmit">
    <label for="promo-code" class="promo__label">Code promo</label>
    <div class="promo__controls">
      <input
        id="promo-code"
        v-model="draft"
        name="promo-code"
        type="text"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        :aria-invalid="refused ? 'true' : undefined"
        aria-describedby="promo-messages"
      />
      <button type="submit" class="promo__apply">Appliquer</button>
    </div>

    <!-- Toujours présente : une zone role="alert" n'est annoncée que si elle existait déjà. -->
    <div id="promo-messages" role="alert" class="promo__messages">
      <p v-for="message in messages" :key="message" :class="{ promo__error: refused }">
        {{ message }}
      </p>
    </div>

    <p v-if="accepted" class="promo__applied">
      Code <strong>{{ code.toUpperCase() }}</strong> appliqué.
      <button type="button" class="promo__clear" @click="onClear">Retirer le code</button>
    </p>
  </form>
</template>

<style scoped>
.promo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.promo__label {
  font-weight: 600;
}
.promo__controls {
  display: flex;
  gap: 0.5rem;
}
.promo__controls input {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.75rem;
  font: inherit;
  border: 1px solid #6b7280;
  border-radius: 0.375rem;
}
.promo__controls input[aria-invalid='true'] {
  border-color: #b91c1c;
}
.promo__apply {
  padding: 0.5rem 1rem;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: #1f2937;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}
.promo__messages p {
  margin: 0;
  font-size: 0.875rem;
  color: #4b5563;
}
.promo__messages .promo__error {
  color: #b91c1c;
}
.promo__applied {
  margin: 0;
  font-size: 0.875rem;
  color: #166534;
}
.promo__clear {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
}
button:focus-visible,
input:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
</style>
