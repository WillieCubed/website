import robots from '@/app/robots';
import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/lib/site';

const result = robots();
const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

function agents(rule: { userAgent?: string | string[] }): string[] {
  return [rule.userAgent ?? []].flat();
}

/** Every user agent that is kept off the whole site. */
const blockedSiteWide = rules
  .filter((rule) => [rule.disallow ?? []].flat().includes('/'))
  .flatMap(agents);

test('training crawlers are kept off the whole site under their real tokens', () => {
  for (const token of [
    'GPTBot',
    'Google-Extended',
    'ClaudeBot',
    'anthropic-ai',
    'Applebot-Extended',
    'meta-externalagent',
    'CCBot',
    'Bytespider',
  ]) {
    assert.ok(blockedSiteWide.includes(token), `${token} is not blocked`);
  }
});

test('the invented Googlebot-Extended token is gone', () => {
  assert.ok(!blockedSiteWide.includes('Googlebot-Extended'));
});

test('search, link-preview, and reader-triggered agents are never blocked', () => {
  for (const bot of [
    'Googlebot',
    'Bingbot',
    'Slackbot',
    'LinkedInBot',
    'facebookexternalhit',
    'Twitterbot',
    'ChatGPT-User',
    'OAI-SearchBot',
    'Claude-User',
    'Claude-SearchBot',
    'PerplexityBot',
    'Perplexity-User',
  ]) {
    assert.ok(!blockedSiteWide.includes(bot), `${bot} must stay allowed`);
  }
});

test('everyone else keeps the site but not the API', () => {
  const everyone = rules.find((rule) => agents(rule).includes('*'));
  assert.ok(everyone);
  // The allow list also carries the MCP endpoint, so that one path under
  // /api/ stays reachable; robots.test.mts covers that entry.
  assert.ok([everyone.allow ?? []].flat().includes('/'));
  assert.ok([everyone.disallow ?? []].flat().includes('/api/'));
});

test('the sitemap is announced on the canonical origin', () => {
  assert.equal(result.sitemap, `${site.origin}/sitemap.xml`);
});
