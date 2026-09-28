import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match.js';
import {
  matchHas,
  prepareDestination,
} from 'next/dist/shared/lib/router/utils/prepare-destination.js';
import assert from 'node:assert/strict';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import test from 'node:test';

import { site } from '@/lib/site';

async function loadRedirects() {
  const { default: config } = await import('../../next.config');
  return (await config.redirects?.()) ?? [];
}

/**
 * Where a request on the canonical host ends up, matched with the same
 * helpers Next.js uses for next.config redirects, or null when no rule
 * applies. A request without a host header never meets a host rule.
 */
async function redirectFor(url: string) {
  const { pathname, searchParams } = new URL(url, site.origin);
  const query = Object.fromEntries(searchParams);
  for (const rule of await loadRedirects()) {
    const pathParams = getPathMatch(rule.source)(pathname);
    if (!pathParams) continue;
    const request = new IncomingMessage(new Socket());
    const hasParams = matchHas(request, query, rule.has, rule.missing);
    if (!hasParams) continue;
    const { parsedDestination } = prepareDestination({
      appendParamsToQuery: false,
      destination: rule.destination,
      params: { ...pathParams, ...hasParams },
      query,
    });
    return {
      pathname: parsedDestination.pathname,
      permanent: 'permanent' in rule ? rule.permanent : undefined,
    };
  }
  return null;
}

test('the old tag filter redirects permanently to the tag page', async () => {
  assert.deepEqual(await redirectFor('/writings?tag=fall-tour-2026'), {
    pathname: '/writings/tags/fall-tour-2026',
    permanent: true,
  });
  assert.deepEqual(await redirectFor('/writings?tag=note&page=2'), {
    pathname: '/writings/tags/note',
    permanent: true,
  });
});

test('the writings index and tag pages themselves are served, not redirected', async () => {
  assert.equal(await redirectFor('/writings'), null);
  assert.equal(await redirectFor('/writings?tag='), null);
  assert.equal(await redirectFor('/writings?q=transit'), null);
  assert.equal(await redirectFor('/writings/tags/note'), null);
  assert.equal(await redirectFor('/writings/tags/note?tag=note'), null);
});
