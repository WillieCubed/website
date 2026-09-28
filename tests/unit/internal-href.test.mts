import assert from 'node:assert/strict';
import test from 'node:test';

import { isInternalHref, site } from '@/lib/site';

const host = new URL(site.origin).host;
const otherScheme = site.origin.startsWith('https:')
  ? site.origin.replace(/^https:/, 'http:')
  : site.origin.replace(/^http:/, 'https:');

test('paths on the site are internal', () => {
  for (const href of [
    '/',
    '/writings',
    '/writings/hello?x=1#top',
    '/?detail=lvbt',
  ]) {
    assert.equal(isInternalHref(href), true, href);
  }
});

test('absolute URLs on the canonical origin are internal', () => {
  for (const href of [
    site.origin,
    `${site.origin}/`,
    `${site.origin}/initiatives/twd`,
    `${site.origin}?detail=lvbt`,
    `${site.origin}#top`,
    site.origin.toUpperCase(),
  ]) {
    assert.equal(isInternalHref(href), true, href);
  }
});

test('a host that only starts with the origin is external', () => {
  for (const href of [
    `${site.origin}.evil.com`,
    `${site.origin}.evil.com/writings`,
    `${site.origin}evil.com`,
    `${site.origin}@evil.com`,
    `${site.origin}:8443/writings`,
    `https://evil.com/${host}`,
    `https://sub.${host}/`,
  ]) {
    assert.equal(isInternalHref(href), false, href);
  }
});

test('a leading slash that browsers read as another host is external', () => {
  for (const href of [
    '//evil.com',
    '//evil.com/writings',
    '/\\evil.com',
    '/\t/evil.com',
  ]) {
    assert.equal(isInternalHref(href), false, JSON.stringify(href));
  }
});

test('other schemes and relative references are not internal', () => {
  for (const href of [
    otherScheme,
    'mailto:hello@willie.page',
    'javascript:alert(1)',
    'https://hypertext.studio',
    '#top',
    '?detail=lvbt',
    'writings/hello',
    '',
  ]) {
    assert.equal(isInternalHref(href), false, href);
  }
});
