import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalWebmentionTarget,
  linksToTarget,
} from '@/lib/indieweb/webmention-targets';
import { absoluteUrl, site } from '@/lib/site';

const canonicalHost = new URL(site.origin).host;
const home = `${site.origin}/`;
const initiative = `${site.origin}/initiatives/fall-tour-2026`;
const writing = `${site.origin}/writings/indiemark-level-3`;
const pages = [home, initiative, `${initiative}/part-1`, writing];

test('the homepage and initiative pages are accepted targets', () => {
  assert.equal(canonicalWebmentionTarget(site.origin, pages), home);
  assert.equal(canonicalWebmentionTarget(home, pages), home);
  assert.equal(canonicalWebmentionTarget(initiative, pages), initiative);
  assert.equal(
    canonicalWebmentionTarget(`${initiative}/part-1`, pages),
    `${initiative}/part-1`
  );
  assert.equal(canonicalWebmentionTarget(writing, pages), writing);
});

test('a target is stored under its canonical address', () => {
  assert.equal(canonicalWebmentionTarget(`${writing}/`, pages), writing);
  assert.equal(
    canonicalWebmentionTarget(`${initiative}?ref=feed#tour`, pages),
    initiative
  );
});

test('a page that does not exist is not a target', () => {
  assert.equal(
    canonicalWebmentionTarget(`${site.origin}/initiatives/nope`, pages),
    null
  );
  assert.equal(
    canonicalWebmentionTarget(`${site.origin}/writings/`, pages),
    null
  );
});

test('another origin or a malformed URL is not a target', () => {
  assert.equal(
    canonicalWebmentionTarget('https://example.com/initiatives/x', pages),
    null
  );
  assert.equal(
    canonicalWebmentionTarget(home.replace('https:', 'http:'), pages),
    null
  );
  assert.equal(canonicalWebmentionTarget('not a url', pages), null);
});

test('a source links to the homepage only by its full address', () => {
  assert.ok(linksToTarget(`<a href="${site.origin}">Willie</a>`, home));
  assert.ok(linksToTarget(`<a href="${home}">Willie</a>`, home));
  assert.ok(linksToTarget(`<a href="${home}?ref=x">Willie</a>`, home));
  assert.ok(linksToTarget(site.origin, home));
  assert.ok(!linksToTarget('<a href="/">Home</a>', home));
  assert.ok(!linksToTarget(`<a href="${writing}">A post</a>`, home));
});

test('a source links to a page by its full address', () => {
  assert.ok(linksToTarget(`<a href="${initiative}">Tour</a>`, initiative));
  assert.ok(linksToTarget(`<a href="${initiative}/">Tour</a>`, initiative));
  assert.ok(
    linksToTarget(`<a href="${initiative}#dates">Tour</a>`, initiative)
  );
  assert.ok(
    !linksToTarget(`<a href="${initiative}/part-1">Part 1</a>`, initiative)
  );
  assert.ok(
    !linksToTarget(`<a href="${initiative}-recap">Recap</a>`, initiative)
  );
});

test('the same path on another origin is not a link to the page', () => {
  assert.ok(
    !linksToTarget(
      '<a href="https://other.example/writings/indiemark-level-3">Theirs</a>',
      writing
    )
  );
  assert.ok(
    !linksToTarget(
      `<a href="https://${canonicalHost}.evil.example/writings/indiemark-level-3">x</a>`,
      writing
    )
  );
  // The source is on another origin, where a relative link stays.
  assert.ok(
    !linksToTarget('<a href="/writings/indiemark-level-3">Post</a>', writing)
  );
});

test('an address inside another URL is not a link to the page', () => {
  assert.ok(
    !linksToTarget(
      `<a href="https://web.archive.org/web/2026/${writing}">Archived</a>`,
      writing
    )
  );
  assert.ok(
    !linksToTarget(
      `<a href="https://share.example/?url=${writing}">Share</a>`,
      writing
    )
  );
});

test('hosts that redirect to the site link to the page they land on', () => {
  const path = '/writings/indiemark-level-3';
  for (const host of site.legacyHosts) {
    assert.ok(
      linksToTarget(`<a href="https://${host}${path}">Post</a>`, writing),
      host
    );
  }
  assert.ok(
    linksToTarget(`<a href="//${canonicalHost}${path}/">Post</a>`, writing)
  );
  for (const [host, aliasPath] of Object.entries(site.aliasHosts)) {
    assert.ok(
      linksToTarget(
        `<a href="https://${host}/">Alias</a>`,
        absoluteUrl(aliasPath)
      ),
      host
    );
  }
});

test('a target on a legacy or alias host is stored under the canonical address', () => {
  const [legacy] = site.legacyHosts;
  assert.equal(
    canonicalWebmentionTarget(
      `https://${legacy}/writings/indiemark-level-3/`,
      pages
    ),
    writing
  );
  const [aliasHost, aliasPath] = Object.entries(site.aliasHosts)[0];
  assert.equal(
    canonicalWebmentionTarget(`https://${aliasHost}/`, [
      ...pages,
      absoluteUrl(aliasPath),
    ]),
    absoluteUrl(aliasPath)
  );
});
