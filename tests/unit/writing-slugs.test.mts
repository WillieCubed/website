import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { parse } from 'node:path';
import test from 'node:test';

import { RESERVED_WRITING_SLUGS } from '@/lib/indieweb/utils';

test('the reserved slugs are the routes under app/writings', () => {
  // Special files such as page.tsx add no segment; metadata images do.
  const special =
    /^(page|layout|loading|error|not-found|template|default|route)$/;
  const routes = readdirSync('app/writings', { withFileTypes: true })
    .map((entry) => (entry.isDirectory() ? entry.name : parse(entry.name).name))
    .filter(
      (name) => !special.test(name) && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name)
    );
  assert.deepEqual([...RESERVED_WRITING_SLUGS].sort(), routes.sort());
});
