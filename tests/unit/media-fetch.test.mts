import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { getMediaMention } from '../../lib/media';
import {
  discoverImages,
  discoverMentionImages,
  fetchMentionImage,
  fetchResource,
} from '../../scripts/fetch-media.mts';

test('article discovery resolves and deduplicates images while preserving captions', () => {
  assert.deepEqual(
    discoverImages(
      `
    <meta property="og:image" content="/photo.jpg">
    <figure><img src="/photo.jpg" alt="Student panel"><figcaption>Photo by Jane Smith</figcaption></figure>
    <img src="//cdn.example.com/video.png">
    <img src="data:image/png;base64,abc">
    <img src="javascript:alert(1)">
  `,
      'https://news.example.com/story'
    ),
    [
      {
        source: 'https://news.example.com/photo.jpg',
        alt: 'Student panel',
        caption: 'Photo by Jane Smith',
      },
      { source: 'https://cdn.example.com/video.png', alt: '', caption: '' },
    ]
  );
});

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'media-fetch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'content/media'), { recursive: true });
  await writeFile(
    join(root, 'content/media/story.md'),
    `---
title: Student panel
publication: Campus News
url: https://news.example.com/story
published: '2023-03-13'
image:
  src: /assets/media/story.png
  source: https://cdn.example.com/panel.png
  alt: Students at a panel.
  credit: Jane Smith
---
`
  );
  return {
    root,
    mention: getMediaMention('story', join(root, 'content/media')),
  };
}

test('fetch saves a selected original without rewriting editorial content', async (t) => {
  const { root, mention } = await fixture(t);
  const file = join(root, 'content/media/story.md');
  const before = await readFile(file, 'utf8');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWMQVDIGAACuAGdAA4zpAAAAAElFTkSuQmCC',
    'base64'
  );
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    assert.equal(url, 'https://cdn.example.com/panel.png');
    // FOX5's CDN returns PNG bytes with a JPEG content type.
    return new Response(png, { headers: { 'content-type': 'image/jpeg' } });
  });
  await fetchMentionImage(mention, root);
  assert.deepEqual(
    await readFile(join(root, 'public/assets/media/story.png')),
    png
  );
  assert.equal(await readFile(file, 'utf8'), before);
});

test('an entry without a selected image discovers candidates at its article URL', async (t) => {
  const { root } = await fixture(t);
  const file = join(root, 'content/media/story.md');
  const content = (await readFile(file, 'utf8')).replace(
    /image:[\s\S]*?---/,
    '---'
  );
  await writeFile(file, content);
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    assert.equal(url, 'https://news.example.com/story');
    return new Response('<meta property="og:image" content="/photo.jpg">');
  });
  assert.deepEqual(
    await discoverMentionImages(
      getMediaMention('story', join(root, 'content/media'))
    ),
    [{ source: 'https://news.example.com/photo.jpg', alt: '', caption: '' }]
  );
  assert.equal(await readFile(file, 'utf8'), content);
});

test('failed or non-image responses never replace an existing asset', async (t) => {
  const { root, mention } = await fixture(t);
  const asset = join(root, 'public/assets/media/story.png');
  await mkdir(join(root, 'public/assets/media'), { recursive: true });
  await writeFile(asset, 'existing image');
  const mock = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('blocked', { status: 403 })
  );
  await assert.rejects(fetchMentionImage(mention, root), /HTTP 403/);
  mock.mock.mockImplementation(
    async () =>
      new Response('<html>not an image</html>', {
        headers: { 'content-type': 'image/png' },
      })
  );
  await assert.rejects(
    fetchMentionImage(mention, root),
    /invalid or undecodable image/
  );
  assert.equal(await readFile(asset, 'utf8'), 'existing image');
});

test('media rejects path traversal before reading content', () => {
  assert.throws(() => getMediaMention('../story'), /content filename/);
});

test('fetch stops oversized downloads and rejects non-HTTP sources', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('12345'));
  await assert.rejects(
    fetchResource('https://example.com/image', 4),
    /exceeds 4 bytes/
  );
  await assert.rejects(fetchResource('file:///etc/passwd', 100), /HTTP source/);
});

test('truncated image data cannot replace a valid cached image', async (t) => {
  const { root, mention } = await fixture(t);
  const asset = join(root, 'public/assets/media/story.png');
  const original = await readFile(
    'public/assets/media/mercury-campus-town-hall.png'
  );
  await mkdir(join(root, 'public/assets/media'), { recursive: true });
  await writeFile(asset, original);
  const mock = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  );
  for (const truncated of [
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    original.subarray(0, Math.floor(original.length / 2)),
  ]) {
    mock.mock.mockImplementation(async () => new Response(truncated));
    await assert.rejects(fetchMentionImage(mention, root), /image/);
    assert.deepEqual(await readFile(asset), original);
  }
});

test('discovery resolves images against the final article URL after redirects', async (t) => {
  const { mention } = await fixture(t);
  t.mock.method(globalThis, 'fetch', async () => {
    const response = new Response('<img src="photo.jpg">');
    Object.defineProperty(response, 'url', {
      value: 'https://news.example.com/new/story/',
    });
    return response;
  });
  assert.deepEqual(await discoverMentionImages(mention), [
    {
      source: 'https://news.example.com/new/story/photo.jpg',
      alt: '',
      caption: '',
    },
  ]);
});

test('discovery includes responsive photos, video posters, and structured article media', () => {
  const candidates = discoverImages(
    `
    <base href="https://cdn.example.com/articles/">
    <img src="placeholder.gif" data-src="photo.jpg" srcset="photo-large.jpg 1200w">
    <picture><source srcset="photo.webp 640w, photo-large.webp 1200w"></picture>
    <video poster="poster.jpg"></video>
    <script type="application/ld+json">{"@type":"VideoObject","thumbnailUrl":"video.jpg"}</script>
    <script>Fusion.globalContent={"content_elements":[{"promo_image":{"url":"original-video.png"}}]};Fusion.globalContentConfig={};</script>
  `,
    'https://news.example.com/story'
  );
  for (const filename of [
    'photo.jpg',
    'photo-large.jpg',
    'photo.webp',
    'photo-large.webp',
    'poster.jpg',
    'video.jpg',
    'original-video.png',
  ]) {
    assert.ok(
      candidates.some(
        ({ source }) =>
          source === `https://cdn.example.com/articles/${filename}`
      ),
      filename
    );
  }
});
