import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests against a production build of the site. Build first
 * (`pnpm build`); the web server below only starts it. Locally a server
 * already running on the port is reused.
 */
const port = Number(process.env.SMOKE_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Every surface follows the colour scheme, so axe checks contrast in
    // both. Route checks answer the same in any browser and run once.
    {
      name: 'desktop-dark',
      testMatch: 'pages.spec.mts',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
    // The site is built for a 390px phone first (docs/design-principles.md).
    {
      name: 'phone',
      testMatch: 'pages.spec.mts',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `pnpm start --port ${port}`,
    url: baseURL,
    reuseExistingServer: !ci,
    timeout: 60_000,
  },
});
