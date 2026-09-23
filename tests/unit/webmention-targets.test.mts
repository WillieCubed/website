import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalWebmentionTarget,
  linksToTarget,
} from '@/lib/indieweb/webmention-targets';
import { site } from '@/lib/site';

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

test('a source links to a page by its address or its path', () => {
  assert.ok(linksToTarget(`<a href="${initiative}">Tour</a>`, initiative));
  assert.ok(linksToTarget(`<a href="${initiative}/">Tour</a>`, initiative));
  assert.ok(
    linksToTarget('<a href="/initiatives/fall-tour-2026">Tour</a>', initiative)
  );
  assert.ok(
    !linksToTarget(`<a href="${initiative}/part-1">Part 1</a>`, initiative)
  );
  assert.ok(
    !linksToTarget(`<a href="${initiative}-recap">Recap</a>`, initiative)
  );
});
