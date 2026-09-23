import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/lib/site';
import { siteRoute } from '@/lib/url-utils';

test('siteRoute builds an absolute URL on the canonical origin', () => {
  const codename = 'orbit';
  assert.equal(
    siteRoute`/projects/${codename}`,
    `${site.origin}/projects/orbit`
  );
  assert.equal(
    siteRoute`/writings/${'hello'}#${2}`,
    `${site.origin}/writings/hello#2`
  );
  assert.equal(siteRoute`/search?q=${'tour'}`, `${site.origin}/search?q=tour`);
});

test('an empty route is the homepage', () => {
  assert.equal(siteRoute``, `${site.origin}/`);
  assert.equal(siteRoute`/`, `${site.origin}/`);
});

test('a route never leaves the canonical origin through its path', () => {
  assert.equal(
    new URL(siteRoute`/writings/${'../../etc'}`).origin,
    site.origin
  );
});
