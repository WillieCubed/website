import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/lib/site';

import { config, proxy } from '../../proxy';

/** Where the proxy sends a request, or null when it lets it through. */
function redirectFor(url: string) {
  const response = proxy(new NextRequest(new URL(url, site.origin)));
  const location = response.headers.get('location');
  if (!location) return null;
  const target = new URL(location);
  return {
    status: response.status,
    path: `${target.pathname}${target.search}`,
  };
}

test('the old tag filter redirects permanently to the tag page', () => {
  assert.deepEqual(redirectFor('/writings?tag=fall-tour-2026'), {
    status: 308,
    path: '/writings/tags/fall-tour-2026',
  });
});

test('the redirect drops the tag query and keeps the rest', () => {
  assert.deepEqual(redirectFor('/writings?tag=Note&page=2'), {
    status: 308,
    path: '/writings/tags/note?page=2',
  });
});

test('an empty tag query leaves the writings index alone', () => {
  assert.equal(redirectFor('/writings?tag='), null);
});

test('the proxy runs only on the writings index with a tag query', () => {
  assert.deepEqual(config.matcher, [
    { source: '/writings', has: [{ type: 'query', key: 'tag' }] },
  ]);
});
