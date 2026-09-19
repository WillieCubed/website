import assert from 'node:assert/strict';
import test from 'node:test';

import { MCP_ENDPOINT } from '@/lib/mcp/constants';

async function everyAgentRule() {
  const { default: robots } = await import('@/app/robots');
  const rules = [robots().rules].flat();
  return rules.find((rule) => [rule.userAgent].flat().includes('*'));
}

test('robots.txt lets every agent reach the MCP endpoint that llms.txt advertises', async () => {
  const rule = await everyAgentRule();

  assert.ok(rule, 'a rule for every user agent');
  assert.ok([rule.allow].flat().includes(MCP_ENDPOINT));
});

test('robots.txt still keeps agents out of the rest of /api/', async () => {
  assert.ok([(await everyAgentRule())?.disallow].flat().includes('/api/'));
});
