<script setup lang="ts">
const props = defineProps<{
  images: string[]
  title: string
}>()

const selected = ref(0)
const current = computed((): string => props.images[selected.value] ?? props.images[0] ?? '')
const hasMany = computed((): boolean => props.images.length > 1)

/** Le texte alternatif dit quelle image est affichée quand il y en a plusieurs. */
const mainAlt = computed((): string =>
  hasMany.value
    ? `${props.title}, image ${selected.value + 1} sur ${props.images.length}`
    : props.title,
)
</script>

<template>
  <div class="gallery">
    <!-- Première image chargée en priorité : c'est le plus gros élément visible (LCP). -->
    <img
      class="gallery__main"
      :src="current"
      :alt="mainAlt"
      width="600"
      height="600"
      fetchpriority="high"
      decoding="async"
    />

    <!-- De vrais boutons : utilisables au clavier (Tab, Entrée, Espace) sans code en plus. -->
    <ul v-if="hasMany" class="gallery__thumbs" aria-label="Choisir une image">
      <li v-for="(image, index) in images" :key="image">
        <button
          type="button"
          class="gallery__thumb"
          :aria-current="index === selected ? 'true' : undefined"
          :aria-label="`Afficher l'image ${index + 1} sur ${images.length}`"
          @click="selected = index"
        >
          <img :src="image" alt="" width="80" height="80" loading="lazy" decoding="async" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.gallery__main {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: contain;
  background: #f3f4f6;
  border-radius: 0.5rem;
}
.gallery__thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.gallery__thumb {
  padding: 0;
  border: 2px solid transparent;
  border-radius: 0.375rem;
  background: #f3f4f6;
  cursor: pointer;
}
.gallery__thumb img {
  display: block;
  width: 4rem;
  height: 4rem;
  object-fit: contain;
}
.gallery__thumb[aria-current='true'] {
  border-color: #1f2937;
}
.gallery__thumb:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
</style>
