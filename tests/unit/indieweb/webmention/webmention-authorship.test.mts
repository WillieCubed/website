import { mf2 } from 'microformats-parser';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type AuthorPageFetcher,
  discoverAuthor,
  findEntry,
} from '@/lib/indieweb/authorship';

const source = 'https://example.com/replies/1';

/** Author pages served from a table; any other address was never meant to be fetched. */
function pages(table: Record<string, string>) {
  const fetched: string[] = [];
  const fetchAuthorPage: AuthorPageFetcher = async (url) => {
    fetched.push(url);
    const html = table[url];
    return html === undefined ? null : { url, html };
  };
  return { fetchAuthorPage, fetched };
}

/** The author of the first h-entry on a source page, as the verifier asks. */
async function authorOf(html: string, fetchAuthorPage: AuthorPageFetcher) {
  const document = mf2(html, { baseUrl: source });
  const found = findEntry(document.items);
  assert.ok(found, 'the page has an h-entry');
  return discoverAuthor(document, found, source, { fetchAuthorPage });
}

const aliceHome = `
  <div class="h-card">
    <a class="u-url u-uid p-name" href="https://alice.example/">Alice</a>
    <img class="u-photo" src="/alice.jpg" alt="">
  </div>
`;

test('an embedded h-card is the author, and nothing is fetched', async () => {
  const { fetchAuthorPage, fetched } = pages({});
  const author = await authorOf(
    `<article class="h-entry">
      <a class="p-author h-card" href="https://ada.example/">Ada</a>
      <p class="e-content">Hi.</p>
    </article>`,
    fetchAuthorPage
  );
  assert.deepEqual(author, { name: 'Ada', url: 'https://ada.example/' });
  assert.deepEqual(fetched, []);
});

test('an author given as text is the name, and nothing is fetched', async () => {
  const { fetchAuthorPage, fetched } = pages({});
  const author = await authorOf(
    `<article class="h-entry"><span class="p-author">Ada</span></article>`,
    fetchAuthorPage
  );
  assert.deepEqual(author, { name: 'Ada' });
  assert.deepEqual(fetched, []);
});

test('an author given as an address is read from that page’s h-card with url and uid', async () => {
  const { fetchAuthorPage, fetched } = pages({
    'https://alice.example/': `
      <div class="h-card"><a class="u-url p-name" href="https://other.example/">Not Alice</a></div>
      ${aliceHome}
    `,
  });
  const author = await authorOf(
    `<article class="h-entry">
      <a class="u-author" href="https://alice.example/"></a>
      <p class="e-content">Hi.</p>
    </article>`,
    fetchAuthorPage
  );
  assert.deepEqual(author, {
    name: 'Alice',
    url: 'https://alice.example/',
    photo: 'https://alice.example/alice.jpg',
  });
  assert.deepEqual(fetched, ['https://alice.example/']);
});

test('without a url and uid match, the h-card whose url is a rel-me link is the author', async () => {
  const { fetchAuthorPage } = pages({
    'https://alice.example/about': `
      <a rel="me" href="https://social.example/@alice">Elsewhere</a>
      <div class="h-card"><span class="p-name">A stranger</span></div>
      <div class="h-card">
        <a class="u-url p-name" href="https://social.example/@alice">Alice</a>
      </div>
    `,
  });
  const author = await authorOf(
    `<article class="h-entry">
      <a class="u-author" href="https://alice.example/about"></a>
    </article>`,
    fetchAuthorPage
  );
  assert.deepEqual(author, {
    name: 'Alice',
    url: 'https://social.example/@alice',
  });
});

test('a permalink page with no author falls back to its rel-author link', async () => {
  const { fetchAuthorPage, fetched } = pages({
    'https://alice.example/': aliceHome,
  });
  const author = await authorOf(
    `<link rel="author" href="https://alice.example/">
    <article class="h-entry"><p class="e-content">Hi.</p></article>`,
    fetchAuthorPage
  );
  assert.equal(author.name, 'Alice');
  assert.deepEqual(fetched, ['https://alice.example/']);
});

test('rel-author does not name the author of an entry on a feed page', async () => {
  const { fetchAuthorPage, fetched } = pages({
    'https://alice.example/': aliceHome,
  });
  const author = await authorOf(
    `<link rel="author" href="https://alice.example/">
    <article class="h-entry"><p class="e-content">One.</p></article>
    <article class="h-entry"><p class="e-content">Two.</p></article>`,
    fetchAuthorPage
  );
  assert.deepEqual(author, {});
  assert.deepEqual(fetched, []);
});

test('an entry in an h-feed takes the feed’s author', async () => {
  const { fetchAuthorPage } = pages({});
  const author = await authorOf(
    `<div class="h-feed">
      <a class="p-author h-card" href="https://bea.example/">Bea</a>
      <article class="h-entry"><p class="e-content">Hi.</p></article>
    </div>`,
    fetchAuthorPage
  );
  assert.deepEqual(author, { name: 'Bea', url: 'https://bea.example/' });
});

test('an author page that cannot be read falls back to an h-card on the entry’s page', async () => {
  const { fetchAuthorPage, fetched } = pages({});
  const author = await authorOf(
    `<header class="h-card">
      <a class="u-url p-name" href="https://cy.example/">Cy</a>
    </header>
    <article class="h-entry">
      <a class="u-author" href="https://cy.example/"></a>
    </article>`,
    fetchAuthorPage
  );
  assert.deepEqual(author, { name: 'Cy', url: 'https://cy.example/' });
  assert.deepEqual(fetched, ['https://cy.example/']);
});

test('an author page with no card of its own still leaves the author’s address', async (t) => {
  t.mock.method(console, 'error', () => {});
  const fetchAuthorPage: AuthorPageFetcher = async () => {
    throw new Error('getaddrinfo ENOTFOUND di.example');
  };
  const author = await authorOf(
    `<article class="h-entry">
      <a class="u-author" href="https://di.example/"></a>
    </article>`,
    fetchAuthorPage
  );
  assert.deepEqual(author, { url: 'https://di.example/' });
});
