import { defineConfig, devices } from '@playwright/test'

// Its own port (BabyTrails uses 4192), and never a server that's already running: a stale build, or
// the other app's, would be tested by mistake.
const PORT = Number(process.env.E2E_PORT ?? 4391)

// Tests run against the production build (with its Content-Security-Policy), not the dev server.
// Locally they use the installed Google Chrome; CI installs Playwright's own Chromium. Same setup as
// BabyTrails.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
