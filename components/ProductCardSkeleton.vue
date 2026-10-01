<template>
  <!-- Purement visuel : la page annonce le chargement via aria-busy et la zone de statut. -->
  <div class="skeleton" aria-hidden="true">
    <div class="skeleton__block skeleton__image" />
    <div class="skeleton__block skeleton__line" />
    <div class="skeleton__block skeleton__line skeleton__line--short" />
  </div>
</template>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
}
.skeleton__block {
  background: #e5e7eb;
  border-radius: 0.375rem;
  animation: pulse 1.5s ease-in-out infinite;
}
.skeleton__image {
  aspect-ratio: 1;
}
.skeleton__line {
  height: 1rem;
}
.skeleton__line--short {
  width: 40%;
}
@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton__block {
    animation: none;
  }
}
</style>
