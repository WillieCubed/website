import assert from 'node:assert/strict';
import test from 'node:test';

import { isParkedPath } from '@/lib/site';

async function loadConfig() {
  const { default: config } = await import('../../next.config');
  return config;
}

test('retired pages redirect temporarily to their replacements', async () => {
  const redirects = (await (await loadConfig()).redirects?.()) ?? [];

  for (const [source, destination] of [
    ['/media', '/initiatives/twd'],
    ['/apps', '/projects'],
  ]) {
    const rule = redirects.find(
      (entry) => entry.source === source && !entry.has
    );
    assert.ok(rule, `a redirect for ${source}`);
    assert.equal(rule.destination, destination);
    assert.equal(rule.permanent, false, `${source} redirects with a 307`);
  }
});

test('retired pages are no longer listed as parked', () => {
  assert.equal(isParkedPath('/media'), false);
  assert.equal(isParkedPath('/apps'), false);
});

test('images load only from hosts a live page uses', async () => {
  const hosts = ((await loadConfig()).images?.remotePatterns ?? []).map(
    (pattern) => pattern.hostname
  );

  for (const retired of [
    'cdn.dribbble.com',
    'i.scdn.co',
    'picsum.photos',
    'lh3.googleusercontent.com',
  ]) {
    assert.ok(!hosts.includes(retired), `${retired} is not allowed`);
  }
});
