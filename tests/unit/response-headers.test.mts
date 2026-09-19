import assert from 'node:assert/strict';
import test from 'node:test';

import { siteHeaders } from '@/lib/response-headers';

const CLACKS = { key: 'X-Clacks-Overhead', value: 'GNU Terry Pratchett' };

test('every path carries the Clacks overhead', () => {
  const rule = siteHeaders.find((entry) => entry.source === '/:path*');

  assert.ok(rule, 'a rule for every path');
  assert.deepEqual(
    rule.headers.find((header) => header.key === CLACKS.key),
    CLACKS
  );
});

test('next.config.ts serves the site headers', async () => {
  const { default: config } = await import('../../next.config');

  assert.deepEqual(await config.headers?.(), siteHeaders);
});
