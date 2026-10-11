import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'studio.spec.mts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    extraHTTPHeaders: {
      'cf-access-jwt-assertion': process.env.STUDIO_TEST_TOKEN || '',
    },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'studio-desktop', use: devices['Desktop Chrome'] },
    { name: 'studio-phone', use: devices['Pixel 7'] },
    {
      name: 'studio-dark',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
  ],
});
