import { mf2 } from 'microformats-parser';
import type { MicroformatRoot } from 'microformats-parser/dist/types';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { HomeContext } from '@/components/home/HomeContext';
import { ProductScroller } from '@/components/home/ProductScroller';
import FeedAuthor from '@/components/indieweb/FeedAuthor';

import { products } from '@/lib/home/ventures';
import { site } from '@/lib/site';

const feedUrl = `${site.origin}/writings`;

test('a feed author is a p-author h-card that points at the homepage', () => {
  const html = renderToStaticMarkup(
    createElement(
      'main',
      { className: 'h-feed' },
      createElement('a', { className: 'u-url', href: feedUrl }),
      createElement(FeedAuthor),
      createElement('h1', { className: 'p-name' }, 'Writings'),
      createElement(
        'article',
        { className: 'h-entry' },
        createElement('p', { className: 'p-name' }, 'A post')
      )
    )
  );
  const { items } = mf2(html, { baseUrl: feedUrl });
  assert.equal(items.length, 1);
  const [feed] = items;
  assert.deepEqual(feed.type, ['h-feed']);
  assert.deepEqual(feed.properties.name, ['Writings']);

  const [author] = feed.properties.author ?? [];
  assert.ok(typeof author === 'object' && author !== null && 'type' in author);
  const card = author as MicroformatRoot;
  assert.deepEqual(card.type, ['h-card']);
  assert.deepEqual(card.properties.name, [site.author.name]);
  assert.deepEqual(card.properties.url, [`${site.origin}/`]);

  // The entry is a child of the feed, not a stray top-level item.
  assert.equal(feed.children?.length, 1);
  assert.deepEqual(feed.children?.[0].type, ['h-entry']);
});

test('product cards carry no class a parser reads as a property', () => {
  const html = renderToStaticMarkup(
    createElement(
      'div',
      { className: 'h-card' },
      createElement(
        HomeContext.Provider,
        {
          value: {
            preview: null,
            setPreview: () => {},
            clearPreview: () => {},
            clearPreviewNow: () => {},
            matches: () => false,
            lit: [],
            openDetail: () => {},
            brands: {},
          },
        },
        createElement(ProductScroller, {
          products: Object.values(products),
          loading: 'lazy',
        })
      )
    )
  );
  const { items } = mf2(html, { baseUrl: site.origin });
  assert.equal(items.length, 1);
  // The wrapper's only properties are the ones implied from its text.
  assert.deepEqual(Object.keys(items[0].properties), ['name']);
});
