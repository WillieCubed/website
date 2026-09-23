import { mf2 } from 'microformats-parser';
import assert from 'node:assert/strict';
import test from 'node:test';

import { extractAuthor } from '@/lib/indieweb/webmention-verifier';

const source = 'https://example.com/replies/1';

/** The first h-entry parsed from `html`, as the verifier reads it. */
function entry(html: string) {
  const [item] = mf2(html, { baseUrl: source }).items;
  assert.ok(item, 'the markup parses to an h-entry');
  return item;
}

test('an h-card photo without alt text is kept as its URL', () => {
  const author = extractAuthor(
    entry(`
      <article class="h-entry">
        <div class="p-author h-card">
          <img class="u-photo" src="/me.jpg" alt="">
          <a class="p-name u-url" href="https://example.com/">Ada Lovelace</a>
        </div>
      </article>
    `)
  );
  assert.deepEqual(author, {
    name: 'Ada Lovelace',
    url: 'https://example.com/',
    photo: 'https://example.com/me.jpg',
  });
});

test('an h-card photo with alt text is kept as its URL', () => {
  const hEntry = entry(`
    <article class="h-entry">
      <div class="p-author h-card">
        <img class="u-photo" src="/me.jpg" alt="Ada, smiling">
        <a class="p-name u-url" href="https://example.com/">Ada Lovelace</a>
      </div>
    </article>
  `);

  // The parser hands the photo back with its alt text, not as a bare URL.
  const [card] = hEntry.properties.author ?? [];
  assert.ok(typeof card === 'object' && 'properties' in card);
  assert.deepEqual(card.properties.photo, [
    { value: 'https://example.com/me.jpg', alt: 'Ada, smiling' },
  ]);

  assert.deepEqual(extractAuthor(hEntry), {
    name: 'Ada Lovelace',
    url: 'https://example.com/',
    photo: 'https://example.com/me.jpg',
  });
});

test('an author given only as a name has no photo or URL', () => {
  const author = extractAuthor(
    entry(
      `<article class="h-entry"><span class="p-author">Ada</span></article>`
    )
  );
  assert.deepEqual(author, { name: 'Ada' });
});
