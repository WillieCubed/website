import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/lib/site';
import { siteRoute } from '@/lib/url-utils';

test('a value after a slash cannot make the route protocol-relative', () => {
  assert.equal(siteRoute`/${'/evil.example'}`, `${site.origin}/evil.example`);
  assert.equal(
    siteRoute`/writings/${'//evil.example'}`,
    `${site.origin}/writings/evil.example`
  );
  assert.equal(siteRoute`/${'\\evil.example'}`, `${site.origin}/evil.example`);
});

test('a route never leaves the canonical origin', () => {
  const hostile = [
    '//evil.example',
    '\\\\evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '\n//evil.example',
    'https://evil.example',
    '//evil.example/path?q=1#frag',
  ];
  for (const value of hostile) {
    assert.equal(new URL(siteRoute`${value}`).origin, site.origin, value);
    assert.equal(new URL(siteRoute`/${value}`).origin, site.origin, value);
    assert.equal(new URL(siteRoute`/a/${value}`).origin, site.origin, value);
  }
});

test('ordinary routes are unchanged', () => {
  assert.equal(siteRoute``, `${site.origin}/`);
  assert.equal(siteRoute`/feed.xml`, `${site.origin}/feed.xml`);
  assert.equal(
    siteRoute`/writings/${'hello'}#${2}`,
    `${site.origin}/writings/hello#2`
  );
  assert.equal(
    siteRoute`${'/initiatives/fall-tour-2026'}`,
    `${site.origin}/initiatives/fall-tour-2026`
  );
  assert.equal(siteRoute`/search?q=${'tour'}`, `${site.origin}/search?q=tour`);
});
