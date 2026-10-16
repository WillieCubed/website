import { GET as searchApi } from '@/app/api/search/route';
import robots from '@/app/robots';
import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  auditPortableContent,
  renderFeedHtml,
} from '@/lib/indieweb/feeds/html';
import { writingToItem } from '@/lib/search/collect';
import { loadPagefind, searchSite } from '@/lib/search/palette/search';
import { site } from '@/lib/site/identity';
import type { WritingData } from '@/lib/writings';

const portable = Buffer.from(
  '## Bus service\n\nEvery **10 minutes**. [Route](/initiatives/transit)'
).toString('base64url');

test('generated blocks carry meaningful portable Markdown in feed HTML', async () => {
  const source = `<StudioBlock id="service" version="1" src="/generated-blocks/service/1.html" portable="${portable}" />`;
  assert.deepEqual(auditPortableContent(source), []);
  const html = await renderFeedHtml(source);
  assert.match(html, /<h2>Bus service<\/h2>/);
  assert.match(html, /<strong>10 minutes<\/strong>/);
  assert.ok(html.includes(`href="${site.origin}/initiatives/transit"`));
  assert.doesNotMatch(html, /iframe|generated-blocks|StudioBlock/);
});

test('publication audit rejects generated blocks without useful portable content', () => {
  assert.ok(auditPortableContent('<StudioBlock id="map" />').length > 0);
  assert.ok(auditPortableContent('<StudioBlock portable="a" />').length > 0);
  const blank = Buffer.from('---').toString('base64url');
  assert.ok(
    auditPortableContent(`<StudioBlock portable="${blank}" />`).length > 0
  );
  const code = Buffer.from('{process.exit(1)}').toString('base64url');
  assert.ok(
    auditPortableContent(`<StudioBlock portable="${code}" />`).length > 0
  );
});

test('legacy interactive blocks and expressions never silently disappear or execute', async () => {
  const html = await renderFeedHtml(
    '<RouteMap title="Downtown bus service" />\n\n<Gallery />\n\n{process.exit(1)}'
  );
  assert.match(html, /Downtown bus service/);
  assert.match(html, /Photo gallery/);
  assert.match(html, /Interactive content/);
  assert.doesNotMatch(html, /process.exit/);
});

test('public syndication requests public writings explicitly', async () => {
  for (const file of [
    'lib/indieweb/feeds/items.ts',
    'lib/mcp/site-content.ts',
    'app/llms.txt/route.ts',
    'app/sitemap.ts',
  ]) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /getAllWritings\(\)/, file);
    assert.match(source, /getAllWritings\(false\)/, file);
  }
});

test('public search indexes portable generated-block prose', () => {
  const writing = {
    slug: 'service',
    title: 'Service',
    description: '',
    tags: [],
    published: new Date('2026-10-10'),
    lastUpdated: new Date('2026-10-10'),
    hasExplicitTitle: true,
    people: [],
    draft: false,
    featured: false,
    readingTime: 1,
    postType: 'article',
  } satisfies WritingData;
  const item = writingToItem(
    writing,
    `<StudioBlock id="service" portable="${portable}" />`
  );
  assert.match(item.content, /Every 10 minutes/);
  assert.doesNotMatch(item.content, /StudioBlock|portable=/);
});

test('interactive feed alternatives link to the original writing', async () => {
  const html = await renderFeedHtml(
    '<RouteMap title="Bus route" />',
    '/writings/bus-route'
  );
  assert.ok(html.includes(`href="${site.origin}/writings/bus-route"`));
  assert.match(html, /Bus route: view on the original page/);
});

test('preview search authenticates before processing any query and never publicly caches rejection', async () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, {
      SITE_MODE: 'preview',
      OWNER_ACCESS_ISSUER: 'https://access.example.com',
      OWNER_ACCESS_AUDIENCE: 'preview-audience',
      OWNER_ACCESS_EMAIL: 'owner@example.com',
    });
    const response = await searchApi(
      new NextRequest('https://preview.willie.page/api/search?q=private-secret')
    );
    assert.equal(response.status, 401);
    assert.match(
      response.headers.get('cache-control') ?? '',
      /private, no-store/
    );
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
    assert.deepEqual(await response.json(), { error: 'Sign in to preview.' });
    assert.deepEqual(robots(), { rules: { userAgent: '*', disallow: '/' } });
  } finally {
    for (const key of [
      'SITE_MODE',
      'OWNER_ACCESS_ISSUER',
      'OWNER_ACCESS_AUDIENCE',
      'OWNER_ACCESS_EMAIL',
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

test('preview palette never loads Pagefind and fetches protected request-time search', async () => {
  const savedMode = process.env.NEXT_PUBLIC_SITE_MODE;
  const savedFetch = globalThis.fetch;
  try {
    process.env.NEXT_PUBLIC_SITE_MODE = 'preview';
    await assert.rejects(loadPagefind(), /private search/);
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/search?q=private%20draft&limit=8');
      assert.equal(options?.cache, 'no-store');
      assert.equal(options?.credentials, 'same-origin');
      return Response.json({
        results: [
          {
            path: '/writings/private',
            title: 'Private writing',
            type: 'writing',
            description: 'Draft description',
          },
        ],
      });
    };
    assert.deepEqual(await searchSite('private draft'), [
      {
        id: 'search:/writings/private',
        title: 'Private writing',
        href: '/writings/private',
        kind: 'writing',
        excerpt: [{ text: 'Draft description', mark: false }],
      },
    ]);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedMode === undefined) delete process.env.NEXT_PUBLIC_SITE_MODE;
    else process.env.NEXT_PUBLIC_SITE_MODE = savedMode;
  }
});
