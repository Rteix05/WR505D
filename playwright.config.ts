import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const isCI = Boolean(process.env.CI)

// Les parcours tournent sur le build de production (comme le site déployé), pas sur le serveur
// de dev : rendu serveur, cookies `secure` et bundles réels sont ceux que verront les visiteurs.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // Les parcours appellent la vraie API DummyJSON : une relance absorbe un aléa réseau en CI.
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // En CI, le build est fait par l'étape précédente du job ; en local, on le refait.
    command: isCI
      ? 'node .output/server/index.mjs'
      : 'npm run build && node .output/server/index.mjs',
    url: `http://localhost:${PORT}`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !isCI,
    timeout: 240_000,
  },
})
