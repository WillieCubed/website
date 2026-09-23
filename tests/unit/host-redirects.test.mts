import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/lib/site';

async function loadRedirects() {
  const { default: config } = await import('../../next.config');
  return (await config.redirects?.()) ?? [];
}

/** The redirect rules that apply only on `host`. */
async function rulesForHost(host: string) {
  return (await loadRedirects()).filter((rule) =>
    rule.has?.some((when) => when.type === 'host' && when.value === host)
  );
}

test('legacy hosts redirect every path permanently to the canonical origin', async () => {
  assert.ok(site.legacyHosts.length > 0);
  for (const host of site.legacyHosts) {
    const rules = await rulesForHost(host);
    assert.equal(rules.length, 1, `one rule for ${host}`);
    const [rule] = rules;
    assert.equal(rule.source, '/:path*');
    assert.equal(rule.destination, `${site.origin}/:path*`);
    assert.equal(rule.permanent, true, `${host} redirects with a 308`);
  }
});

test('alias hosts redirect temporarily to their path on the canonical origin', async () => {
  const aliases = Object.entries(site.aliasHosts);
  assert.ok(aliases.length > 0);
  for (const [host, path] of aliases) {
    const rules = await rulesForHost(host);
    assert.equal(rules.length, 1, `one rule for ${host}`);
    const [rule] = rules;
    assert.equal(rule.source, '/:path*');
    assert.equal(rule.destination, `${site.origin}${path}`);
    assert.ok(path.startsWith('/'), `${host} points at a rooted path`);
    assert.equal(rule.permanent, false, `${host} redirects with a 307`);
  }
});

test('the canonical host never redirects to itself', async () => {
  const canonical = new URL(site.origin).host;
  assert.deepEqual(await rulesForHost(canonical), []);
  assert.ok(!(site.legacyHosts as readonly string[]).includes(canonical));
  assert.ok(!(canonical in site.aliasHosts));
});

test('every host rule lands on the canonical origin', async () => {
  for (const rule of await loadRedirects()) {
    if (!rule.has) continue;
    assert.equal(
      new URL(rule.destination).origin,
      site.origin,
      `${rule.has.map((when) => when.value).join(', ')} stays on the site`
    );
  }
});
