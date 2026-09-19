import robots from '@/app/robots';
import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/lib/site';

const result = robots();
const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

function agents(rule: { userAgent?: string | string[] }): string[] {
  return [rule.userAgent ?? []].flat();
}

/** Every user agent that is kept out of /writings/. */
const blockedFromWritings = rules
  .filter((rule) => [rule.disallow ?? []].flat().includes('/writings/'))
  .flatMap(agents);

test('training crawlers are kept out of /writings/ under their real tokens', () => {
  for (const token of [
    'GPTBot',
    'Google-Extended',
    'ClaudeBot',
    'anthropic-ai',
    'Applebot-Extended',
    'meta-externalagent',
    'CCBot',
  ]) {
    assert.ok(blockedFromWritings.includes(token), `${token} is not blocked`);
  }
});

test('the invented Googlebot-Extended token is gone', () => {
  assert.ok(!blockedFromWritings.includes('Googlebot-Extended'));
});

test('search and link-preview bots are never blocked from /writings/', () => {
  for (const bot of [
    'Googlebot',
    'Bingbot',
    'Slackbot',
    'LinkedInBot',
    'facebookexternalhit',
    'Twitterbot',
  ]) {
    assert.ok(!blockedFromWritings.includes(bot), `${bot} must stay allowed`);
  }
});

test('everyone else keeps the site but not the API', () => {
  const everyone = rules.find((rule) => agents(rule).includes('*'));
  assert.ok(everyone);
  assert.equal(everyone.allow, '/');
  assert.ok([everyone.disallow ?? []].flat().includes('/api/'));
});

test('the sitemap is announced on the canonical origin', () => {
  assert.equal(result.sitemap, `${site.origin}/sitemap.xml`);
});
