import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

import base from './site.config.mts';

export default defineConfig({
  ...base,
  testMatch: [
    '**/initiatives/fall-tour.spec.mts',
    '**/initiatives/route-map.spec.mts',
  ],
  outputDir: join(import.meta.dirname, '../test-results/fall-tour'),
  workers: 1,
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    extraHTTPHeaders: {
      'cf-access-jwt-assertion': process.env.STUDIO_TEST_TOKEN || '',
    },
  },
  projects: ['light', 'dark'].flatMap((colorScheme) => [
    {
      name: `desktop-${colorScheme}`,
      use: {
        viewport: { width: 1440, height: 1000 },
        colorScheme: colorScheme as 'light' | 'dark',
      },
    },
    {
      name: `phone-${colorScheme}`,
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        colorScheme: colorScheme as 'light' | 'dark',
      },
    },
  ]),
});
