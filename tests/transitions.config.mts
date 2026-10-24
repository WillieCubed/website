import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

import base from './site.config.mts';

export default defineConfig({
  ...base,
  testMatch: [
    '**/site/view-transitions.spec.mts',
    '**/site/breadcrumbs.spec.mts',
  ],
  outputDir: join(import.meta.dirname, '../test-results/transitions'),
  workers: 1,
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    extraHTTPHeaders: {
      'cf-access-jwt-assertion': process.env.STUDIO_TEST_TOKEN || '',
    },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'phone',
      testMatch: '**/site/view-transitions.spec.mts',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
});
