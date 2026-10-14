import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/lib/site/identity';
import { absoluteRoute } from '@/lib/site/urls';

test('absoluteRoute builds an absolute URL on the canonical origin', () => {
  const codename = 'orbit';
  assert.equal(
    absoluteRoute`/projects/${codename}`,
    `${site.origin}/projects/orbit`
  );
  assert.equal(
    absoluteRoute`/writings/${'hello'}#${2}`,
    `${site.origin}/writings/hello#2`
  );
  assert.equal(
    absoluteRoute`/search?q=${'tour'}`,
    `${site.origin}/search?q=tour`
  );
});

test('an empty route is the homepage', () => {
  assert.equal(absoluteRoute``, `${site.origin}/`);
  assert.equal(absoluteRoute`/`, `${site.origin}/`);
});

test('a route never leaves the canonical origin through its path', () => {
  assert.equal(
    new URL(absoluteRoute`/writings/${'../../etc'}`).origin,
    site.origin
  );
});
