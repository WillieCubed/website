import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

import base from './loading.config.mts';

export default defineConfig({
  ...base,
  testDir: './e2e/site/music',
  testMatch: 'music-eggs.spec.mts',
  outputDir: join(import.meta.dirname, '../test-results/music-public'),
  use: { ...base.use, extraHTTPHeaders: {} },
});
