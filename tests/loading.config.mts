import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

export default defineConfig({
  testDir: './e2e/site/loading',
  outputDir: join(import.meta.dirname, '../test-results/loading'),
  workers: 1,
  use: {
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    extraHTTPHeaders: {
      'cf-access-jwt-assertion': process.env.STUDIO_TEST_TOKEN || '',
    },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-light', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile-light',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop-dark',
      use: { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
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
