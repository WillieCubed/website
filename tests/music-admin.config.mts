import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

export default defineConfig({
  outputDir: join(import.meta.dirname, '../test-results/music-admin'),
  testDir: './e2e/site/music',
  testMatch: 'music-admin.spec.mts',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    extraHTTPHeaders: {
      'cf-access-jwt-assertion': process.env.STUDIO_TEST_TOKEN || '',
    },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-light',
      use: { viewport: { width: 1440, height: 1000 }, colorScheme: 'light' },
    },
    {
      name: 'mobile-light',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: 'light',
      },
    },
    {
      name: 'desktop-dark',
      use: { viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' },
    },
    {
      name: 'mobile-dark',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: 'dark',
      },
    },
  ],
});
