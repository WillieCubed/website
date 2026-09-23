import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLlmsSummary } from '@/lib/indieweb/discovery';
import { MCP_ENDPOINT } from '@/lib/mcp/constants';
import { site } from '@/lib/site';

async function robotsRules() {
  const { default: robots } = await import('@/app/robots');
  return [robots().rules].flat();
}

async function everyAgentRule() {
  const rules = await robotsRules();
  return rules.find((rule) => [rule.userAgent].flat().includes('*'));
}

/**
 * Whether robots.txt lets `agent` fetch `path`, per RFC 9309: the agent's
 * own group if it has one, otherwise `*`, and the longest matching rule
 * wins, with Allow winning a tie.
 */
async function allows(agent: string, path: string): Promise<boolean> {
  const rules = await robotsRules();
  const named = rules.find((rule) =>
    [rule.userAgent]
      .flat()
      .some((token) => token?.toLowerCase() === agent.toLowerCase())
  );
  const group =
    named ?? rules.find((rule) => [rule.userAgent].flat().includes('*'));
  assert.ok(group, `a group applies to ${agent}`);

  const longest = (prefixes: (string | undefined)[]) =>
    Math.max(
      -1,
      ...prefixes
        .filter(
          (prefix): prefix is string => !!prefix && path.startsWith(prefix)
        )
        .map((prefix) => prefix.length)
    );
  return longest([group.allow].flat()) >= longest([group.disallow].flat());
}

/** Every same-site path llms.txt links, with one published writing. */
function llmsPaths(): string[] {
  const summary = buildLlmsSummary([
    { slug: 'hello', title: 'Hello', description: 'A first post' },
  ]);
  return [...summary.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)]
    .map(([, url]) => url)
    .filter((url) => url.startsWith(site.origin))
    .map((url) => url.slice(site.origin.length) || '/');
}

test('robots.txt lets every agent reach the MCP endpoint that llms.txt advertises', async () => {
  const rule = await everyAgentRule();

  assert.ok(rule, 'a rule for every user agent');
  assert.ok([rule.allow].flat().includes(MCP_ENDPOINT));
});

test('robots.txt still keeps agents out of the rest of /api/', async () => {
  assert.ok([(await everyAgentRule())?.disallow].flat().includes('/api/'));
});

test('robots.txt drops the rules for routes that do not exist', async () => {
  const disallowed = (await robotsRules()).flatMap((rule) =>
    [rule.disallow].flat()
  );
  for (const path of ['/admin/', '/hi/']) {
    assert.ok(!disallowed.includes(path), `${path} is still disallowed`);
  }
});

test('agents reading for a person and AI search can open everything llms.txt links', async () => {
  const paths = llmsPaths();
  assert.ok(paths.includes('/writings/hello'));
  assert.ok(paths.includes(MCP_ENDPOINT));

  for (const agent of [
    'ChatGPT-User',
    'OAI-SearchBot',
    'Claude-User',
    'Claude-SearchBot',
    'PerplexityBot',
    'Perplexity-User',
  ]) {
    for (const path of paths) {
      assert.ok(await allows(agent, path), `${agent} is kept off ${path}`);
    }
  }
});

test('training crawlers can open nothing llms.txt links', async () => {
  for (const agent of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot']) {
    for (const path of llmsPaths()) {
      assert.ok(!(await allows(agent, path)), `${agent} may fetch ${path}`);
    }
  }
});

test('llms.txt states the same policy and points at robots.txt', () => {
  assert.ok(buildLlmsSummary().includes(`(${site.origin}/robots.txt)`));
});
