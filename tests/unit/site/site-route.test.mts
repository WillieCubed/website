import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/lib/site/identity';
import { absoluteRoute } from '@/lib/site/urls';

test('a value after a slash cannot make the route protocol-relative', () => {
  assert.equal(
    absoluteRoute`/${'/evil.example'}`,
    `${site.origin}/evil.example`
  );
  assert.equal(
    absoluteRoute`/writings/${'//evil.example'}`,
    `${site.origin}/writings/evil.example`
  );
  assert.equal(
    absoluteRoute`/${'\\evil.example'}`,
    `${site.origin}/evil.example`
  );
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
    assert.equal(new URL(absoluteRoute`${value}`).origin, site.origin, value);
    assert.equal(new URL(absoluteRoute`/${value}`).origin, site.origin, value);
    assert.equal(
      new URL(absoluteRoute`/a/${value}`).origin,
      site.origin,
      value
    );
  }
});

test('ordinary routes are unchanged', () => {
  assert.equal(absoluteRoute``, `${site.origin}/`);
  assert.equal(absoluteRoute`/feed.xml`, `${site.origin}/feed.xml`);
  assert.equal(
    absoluteRoute`/writings/${'hello'}#${2}`,
    `${site.origin}/writings/hello#2`
  );
  assert.equal(
    absoluteRoute`${'/initiatives/fall-tour-2026'}`,
    `${site.origin}/initiatives/fall-tour-2026`
  );
  assert.equal(
    absoluteRoute`/search?q=${'tour'}`,
    `${site.origin}/search?q=tour`
  );
});
