import assert from 'node:assert/strict';
import test from 'node:test';

async function loadRedirects() {
  const { default: config } = await import('../../next.config');
  return (await config.redirects?.()) ?? [];
}

test('guessed feed paths redirect permanently to the real feeds', async () => {
  const redirects = await loadRedirects();

  for (const [source, destination] of [
    ['/rss.xml', '/feed.xml'],
    ['/rss', '/feed.xml'],
    ['/feed', '/feed.xml'],
    ['/index.xml', '/feed.xml'],
    ['/atom.xml', '/feed/atom'],
  ]) {
    const rule = redirects.find(
      (entry) => entry.source === source && !entry.has
    );
    assert.ok(rule, `a redirect for ${source}`);
    assert.equal(rule.destination, destination);
    assert.equal(rule.permanent, true, `${source} redirects with a 308`);
  }
});

test('the real feeds are never redirected', async () => {
  const redirects = await loadRedirects();

  for (const path of ['/feed.xml', '/feed/atom', '/feed/json']) {
    assert.ok(
      !redirects.some((entry) => entry.source === path && !entry.has),
      `${path} is served, not redirected`
    );
  }
});
