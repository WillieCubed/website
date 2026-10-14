import assert from 'node:assert/strict';
import test from 'node:test';

import { blueskyPostIntent, threadsPostIntent } from '@/lib/indieweb/posse';

const original = 'https://willie.page/writings/a-note';

test('a note opens an editable Threads draft with its original URL', () => {
  const intent = new URL(
    threadsPostIntent(
      {
        title: 'A note',
        description: 'A note about the site.',
        hasExplicitTitle: false,
      },
      original
    )
  );

  assert.equal(intent.origin, 'https://www.threads.com');
  assert.equal(intent.pathname, '/intent/post');
  assert.equal(intent.searchParams.get('text'), 'A note about the site.');
  assert.equal(intent.searchParams.get('url'), original);
});

test('an article uses its title in the Threads draft', () => {
  const intent = new URL(
    threadsPostIntent(
      {
        title: 'A longer article',
        description: 'A summary of the article.',
        hasExplicitTitle: true,
      },
      original
    )
  );

  assert.equal(intent.searchParams.get('text'), 'A longer article');
  assert.equal(intent.searchParams.get('url'), original);
});

test('a Bluesky draft carries the share text and the original URL', () => {
  const intent = new URL(
    blueskyPostIntent(
      {
        title: 'A longer article',
        description: 'A summary of the article.',
        hasExplicitTitle: true,
      },
      original
    )
  );

  assert.equal(intent.origin, 'https://bsky.app');
  assert.equal(intent.pathname, '/intent/compose');
  assert.equal(
    intent.searchParams.get('text'),
    `A longer article\n\n${original}`
  );
});

test('a note shares its own words on Bluesky', () => {
  const intent = new URL(
    blueskyPostIntent(
      {
        title: 'A note',
        description: 'A note about the site.',
        hasExplicitTitle: false,
      },
      original
    )
  );

  assert.equal(
    intent.searchParams.get('text'),
    `A note about the site.\n\n${original}`
  );
});
