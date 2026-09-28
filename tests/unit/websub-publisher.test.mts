import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HTML_FEED_PATHS,
  SITE_FEED_PATHS,
  pingWebSubHub,
  publishedTopicPaths,
  webSubTopicPaths,
} from '@/lib/indieweb/websub-publisher';
import { getWritingSlugs, loadWriting } from '@/lib/writings';

test('WebSub notifies the hub once for each public feed', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; feeds: string[]; mode: string | null }> =
    [];
  globalThis.fetch = async (input, init) => {
    const body = new URLSearchParams(String(init?.body));
    calls.push({
      url: String(input),
      feeds: body.getAll('hub.url'),
      mode: body.get('hub.mode'),
    });
    return new Response(null, { status: 204 });
  };
  try {
    const result = await pingWebSubHub(
      ['https://example.org/feed.xml', 'https://example.org/feed/atom'],
      'https://hub.example/subscribe'
    );
    assert.deepEqual(result, { ok: true, status: 204 });
    assert.deepEqual(calls, [
      {
        url: 'https://hub.example/subscribe',
        feeds: ['https://example.org/feed.xml'],
        mode: 'publish',
      },
      {
        url: 'https://hub.example/subscribe',
        feeds: ['https://example.org/feed/atom'],
        mode: 'publish',
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WebSub reports a rejected feed', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(null, { status: calls === 2 ? 503 : 204 });
  };
  try {
    assert.deepEqual(
      await pingWebSubHub(
        ['https://example.org/feed.xml', 'https://example.org/feed/atom'],
        'https://hub.example/subscribe'
      ),
      { ok: false, status: 503 }
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WebSub treats an unregistered topic without subscribers as idle', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? new Response('Topic not found for topic URL.', { status: 500 })
      : new Response(null, { status: 202 });
  };
  try {
    assert.deepEqual(
      await pingWebSubHub(
        ['https://example.org/feed.xml', 'https://example.org/feed/atom'],
        'https://websubhub.com/hub'
      ),
      { ok: true, status: 202 }
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the hub hears about the writings page and every tag page and feed', () => {
  assert.deepEqual(webSubTopicPaths(['note']), [
    ...SITE_FEED_PATHS,
    '/writings',
    '/writings/tags/note',
    '/writings/tags/note/feed.xml',
    '/writings/tags/note/feed/atom',
    '/writings/tags/note/feed/json',
  ]);
  assert.deepEqual(HTML_FEED_PATHS, ['/writings']);
});

test('the published topics cover the tags of published posts, never drafts', async () => {
  const topics = new Set(await publishedTopicPaths());
  const tagPages = [...topics].filter((path) =>
    /^\/writings\/tags\/[^/]+$/.test(path)
  );
  const published = new Set<string>();
  const draftOnly = new Set<string>();
  for (const slug of await getWritingSlugs()) {
    const { writing } = await loadWriting(slug);
    for (const tag of writing.tags.map((t) => t.toLowerCase())) {
      (writing.draft ? draftOnly : published).add(tag);
    }
  }
  for (const tag of published) draftOnly.delete(tag);

  assert.deepEqual(
    tagPages.sort(),
    [...published].sort().map((tag) => `/writings/tags/${tag}`)
  );
  for (const tag of draftOnly) {
    assert.ok(!topics.has(`/writings/tags/${tag}`), `draft tag ${tag}`);
  }
  for (const path of [...SITE_FEED_PATHS, ...HTML_FEED_PATHS]) {
    assert.ok(topics.has(path), path);
  }
});
