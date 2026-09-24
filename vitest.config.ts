import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        // Fonctions pures (utils/) : environnement Node, rapide
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        // Composants, composables, stores : environnement Nuxt
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
        },
      }),
    ],
    coverage: {
      provider: 'v8',
      include: ['utils/**/*.ts', 'composables/**/*.ts', 'stores/**/*.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        // Exigence du sujet : >= 90 % lignes et branches sur le moteur de promotions
        'utils/promotions.ts': {
          lines: 90,
          branches: 90,
        },
      },
    },
  },
})
