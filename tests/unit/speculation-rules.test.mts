import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPECULATION_EXCLUDED_PATHS,
  SPECULATION_RULES,
} from '@/lib/speculation-rules';

const base = 'https://willie.page/writings';

/** Whether the href rules pick a link up, resolved as a browser would. */
function prefetched(href: string): boolean {
  const url = new URL(href, base).href;
  const inSite = new URLPattern('/*', base).test(url);
  const excluded = SPECULATION_EXCLUDED_PATHS.some((path) =>
    new URLPattern(path, base).test(url)
  );
  return inSite && !excluded;
}

test('every exclusion is a URL pattern a browser can parse', () => {
  for (const path of SPECULATION_EXCLUDED_PATHS) {
    assert.doesNotThrow(() => new URLPattern(path, base), path);
  }
});

test('pages on the site are prefetched on moderate eagerness', () => {
  const [rule] = SPECULATION_RULES.prefetch;
  assert.equal(rule.eagerness, 'moderate');
  assert.ok(!('prerender' in SPECULATION_RULES));

  for (const href of [
    '/',
    '/writings',
    '/writings/indiemark-checklist',
    '/initiatives/fall-tour-2026/part-1',
    '/search?q=transit',
    '/brand',
  ]) {
    assert.ok(prefetched(href), href);
  }
});

test('route handlers, feeds, protocol endpoints, and files are not', () => {
  for (const href of [
    '/api/mcp',
    '/feed.xml',
    '/feed/atom',
    '/writings/feed/json',
    '/activity/feed.xml',
    '/writings/indiemark-checklist/activity/feed/atom',
    '/micropub',
    '/micropub/media',
    '/webmention',
    '/webmentions?target=https://willie.page/',
    '/indieauth/auth',
    '/indieauth/token',
    '/indieauth/consent',
    '/oembed?url=https://willie.page/',
    '/coffee',
    '/tea',
    '/whoami',
    '/.well-known/security.txt',
    '/humans.txt',
    '/brand/web/icon-48.png',
    'https://hypertext.studio/',
  ]) {
    assert.ok(!prefetched(href), href);
  }
});

test('links marked nofollow, opening a new tab, or downloading are left out', () => {
  const selector = JSON.stringify(SPECULATION_RULES);
  for (const part of ['[rel~="nofollow"]', '[target="_blank"]', '[download]']) {
    assert.ok(selector.includes(JSON.stringify(part).slice(1, -1)), part);
  }
});
