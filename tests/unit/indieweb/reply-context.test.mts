import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanMetaText,
  extractMicroformats,
} from '@/lib/indieweb/reply-context';

test('cleanMetaText decodes entities and folds whitespace', () => {
  assert.equal(
    cleanMetaText('✅&#10;IndieMark is an   in-progress&nbsp;guide'),
    '✅ IndieMark is an in-progress guide'
  );
  assert.equal(
    cleanMetaText('Tom &amp; Jerry &#x2014; &quot;hi&quot;'),
    'Tom & Jerry — "hi"'
  );
  assert.equal(cleanMetaText('   '), undefined);
  assert.equal(cleanMetaText(undefined), undefined);
});

test('extractMicroformats reads the entry and only its own author', () => {
  const html = `
    <article class="h-entry">
      <h1 class="p-name">A &amp; B</h1>
      <p class="p-summary">First&#10;line</p>
      <time class="dt-published" datetime="2026-09-18T09:30-07:00">Sep 18</time>
      <span class="p-author h-card"><a class="p-name u-url" href="/me">Someone</a><img class="u-photo" src="/me.png" alt=""></span>
      <div class="h-card"><a class="p-name u-url" href="/other">Contributor</a></div>
    </article>`;
  const context = extractMicroformats(html, 'https://example.com/post');
  assert.equal(context.title, 'A & B');
  assert.equal(context.contentPreview, 'First line');
  assert.equal(context.publishedAt?.toISOString(), '2026-09-18T16:30:00.000Z');
  assert.equal(context.authorName, 'Someone');
  assert.equal(context.authorUrl, 'https://example.com/me');
  assert.equal(context.authorPhoto, 'https://example.com/me.png');
});

test('extractMicroformats returns nothing for a page without an h-entry', () => {
  assert.deepEqual(
    extractMicroformats('<p>plain</p>', 'https://example.com'),
    {}
  );
});

test('reply metadata keeps its existing priority and blank-value semantics', async (t) => {
  const { getReplyContext } = await import('@/lib/indieweb/reply-context');
  const postgres = process.env.POSTGRES_URL;
  const database = process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL;
  t.after(() => {
    if (postgres === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = postgres;
    if (database === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = database;
  });
  let html = '';
  t.mock.method(globalThis, 'fetch', async () => new Response(html));
  const read = () => getReplyContext('https://www.example.com/post');
  html = `<meta property="og:title" content="OG &amp; title">
    <meta name="twitter:title" content="Twitter"><title>Document</title>
    <meta property="og:description" content="OG preview">
    <meta name="description" content="Description">
    <meta property="og:site_name" content="OG site">
    <meta name="twitter:site" content="@twitter">`;
  let context = await read();
  assert.equal(context.title, 'OG & title');
  assert.equal(context.contentPreview, 'OG preview');
  assert.equal(context.siteName, 'OG site');
  html = `<meta name="twitter:title" content="Twitter"><title>Document</title>
    <meta name="description" content="Description">
    <meta name="twitter:site" content="@twitter">`;
  context = await read();
  assert.equal(context.title, 'Twitter');
  assert.equal(context.contentPreview, 'Description');
  assert.equal(context.siteName, 'twitter');
  html = '<title>Document</title>';
  context = await read();
  assert.equal(context.title, 'Document');
  assert.equal(context.siteName, 'example.com');
  html = `<meta property="og:title" content=" "><meta name="twitter:title" content="Twitter">
    <meta property="og:description" content=" "><meta name="description" content="Description">
    <meta property="og:site_name" content=" "><meta name="twitter:site" content="@twitter">`;
  context = await read();
  assert.equal(context.title, undefined);
  assert.equal(context.contentPreview, undefined);
  assert.equal(context.siteName, undefined);
  html = `<meta property="og:title" content="OG"><meta property="og:description" content="OG preview">
    <article class="h-entry"><h1 class="p-name">Entry</h1><p class="p-summary">Summary</p></article>`;
  context = await read();
  assert.equal(context.title, 'Entry');
  assert.equal(context.contentPreview, 'Summary');
});

test('reply cache binds every stored value and refreshes all mutable columns', async (t) => {
  const { Pool } = await import('pg');
  const { getReplyContext } = await import('@/lib/indieweb/reply-context');
  const { sql } = await import('@/lib/db/postgres');
  const postgres = process.env.POSTGRES_URL;
  process.env.POSTGRES_URL =
    'postgres://unused:unused@localhost/reply-context-test';
  const statements: { text: string; values: unknown[] }[] = [];
  t.mock.method(
    Pool.prototype,
    'query',
    async (text: string, values: unknown[] = []) => {
      statements.push({ text, values });
      return { rows: [] };
    }
  );
  t.after(async () => {
    await sql.end();
    if (postgres === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = postgres;
  });
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(`<article class="h-entry">
    <h1 class="p-name">Title</h1><p class="p-summary">Preview</p>
    <time class="dt-published" datetime="2026-10-22T12:00:00Z"></time>
    <span class="p-author h-card"><a class="p-name u-url" href="/author">Author</a><img class="u-photo" src="/photo.png"></span>
    </article><meta property="og:site_name" content="Site">`)
  );
  const url = "https://example.com/post?quote='value";
  await getReplyContext(url);
  assert.deepEqual(statements[0].values, [url, 168]);
  const insert = statements[1];
  const columns = insert.text
    .match(/INSERT INTO reply_context_cache\s*\(([^)]+)\)/)?.[1]
    .split(',')
    .map((column) => column.trim());
  const expressions = insert.text
    .match(/VALUES\s*\(([\s\S]*?)\)\s*ON CONFLICT/)?.[1]
    .split(',')
    .map((value) => value.trim());
  assert.ok(columns);
  assert.ok(expressions);
  const stored = Object.fromEntries(
    columns.map((column, index) => {
      const parameter = expressions[index].match(/^\$(\d+)$/);
      return [
        column,
        parameter
          ? insert.values[Number(parameter[1]) - 1]
          : expressions[index],
      ];
    })
  );
  assert.deepEqual(stored, {
    target_url: url,
    author_name: 'Author',
    author_url: 'https://example.com/author',
    author_photo: 'https://example.com/photo.png',
    title: 'Title',
    content_preview: 'Preview',
    published_at: '2026-10-22T12:00:00.000Z',
    site_name: 'Site',
    fetched_at: 'NOW()',
    raw_mf2_json: JSON.stringify({
      title: 'Title',
      contentPreview: 'Preview',
      publishedAt: '2026-10-22T12:00:00.000Z',
      authorName: 'Author',
      authorUrl: 'https://example.com/author',
      authorPhoto: 'https://example.com/photo.png',
    }),
  });
  for (const column of columns.filter((column) => column !== 'target_url')) {
    assert.match(
      insert.text,
      new RegExp(`${column}\\s*=\\s*(?:EXCLUDED\\.${column}|NOW\\(\\))`)
    );
  }
  statements.length = 0;
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 404 })
  );
  const minimal = await getReplyContext(url);
  assert.equal(minimal.title, undefined);
  assert.deepEqual(
    statements[1].values.filter((value) => value !== url),
    [null, null, null, null, null, null, null, '{}']
  );
});
