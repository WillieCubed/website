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
