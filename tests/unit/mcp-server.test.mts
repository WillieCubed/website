import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type SiteContent,
  createSiteMcpHandler,
  summarizeWriting,
} from '@/lib/mcp/site-server';
import { site } from '@/lib/site';

const content: SiteContent = {
  async listWritings() {
    return [
      {
        slug: 'hello',
        title: 'Hello',
        description: 'A first note.',
        published: '2026-05-01T00:00:00.000Z',
        tags: ['meta'],
      },
    ];
  },
  async readWriting(slug) {
    if (slug !== 'hello') return null;
    return {
      slug: 'hello',
      title: 'Hello',
      description: 'A first note.',
      published: '2026-05-01T00:00:00.000Z',
      tags: ['meta'],
      markdown: 'Body of the first note.',
    };
  },
  async searchWritings(query, limit) {
    return query === 'hello'
      ? [
          {
            slug: 'hello',
            title: 'Hello',
            description: 'A first note.',
            published: '2026-05-01T00:00:00.000Z',
            tags: ['meta'],
            snippet: `limit was ${limit}`,
          },
        ]
      : [];
  },
  async listInitiatives() {
    return [
      {
        slug: 'superbloom',
        title: 'Project Superbloom',
        description: 'A campaign.',
        kind: 'campaign',
        status: 'active',
      },
    ];
  },
};

const handler = createSiteMcpHandler(content);

// The handler answers as a server-sent event stream; the reply is the
// JSON-RPC message on its `data:` line.
async function rpc(method: string, params?: unknown) {
  const response = await handler(
    new Request(`${site.origin}/api/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
  );
  const text = await response.text();
  const line = text.split('\n').find((entry) => entry.startsWith('data: '));
  assert.ok(line, `no data line in: ${text}`);
  return JSON.parse(line.slice('data: '.length));
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const reply = await rpc('tools/call', { name, arguments: args });
  return reply.result as {
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
  };
}

test('the server lists its read-only tools', async () => {
  const reply = await rpc('tools/list');
  const names = reply.result.tools.map((tool: { name: string }) => tool.name);

  assert.deepEqual(names.sort(), [
    'brew_coffee',
    'get_profile',
    'get_writing',
    'list_initiatives',
    'list_writings',
    'search_writings',
  ]);
});

test('get_profile describes the site from lib/site.ts', async () => {
  const result = await callTool('get_profile');
  const profile = JSON.parse(result.content[0].text);

  assert.equal(profile.name, site.name);
  assert.equal(profile.url, site.origin);
  assert.equal(profile.social.length, site.social.length);
  assert.equal(profile.llms, `${site.origin}/llms.txt`);
});

test('list_writings returns published writings with absolute URLs', async () => {
  const result = await callTool('list_writings');
  const writings = JSON.parse(result.content[0].text);

  assert.equal(writings.length, 1);
  assert.equal(writings[0].slug, 'hello');
  assert.equal(writings[0].url, `${site.origin}/writings/hello`);
  assert.deepEqual(writings[0].tags, ['meta']);
});

test('get_writing returns the writing as markdown with its metadata', async () => {
  const result = await callTool('get_writing', { slug: 'hello' });
  const text = result.content[0].text;

  assert.ok(!result.isError);
  assert.match(text, /^# Hello$/m);
  assert.match(text, new RegExp(`${site.origin}/writings/hello`));
  assert.match(text, /Body of the first note\./);
});

test('get_writing reports a missing writing as a tool error', async () => {
  const result = await callTool('get_writing', { slug: 'nope' });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /No published writing "nope"/);
});

test('search_writings passes the query and limit through and returns URLs', async () => {
  const result = await callTool('search_writings', {
    query: 'hello',
    limit: 3,
  });
  const found = JSON.parse(result.content[0].text);

  assert.equal(found[0].url, `${site.origin}/writings/hello`);
  assert.equal(found[0].snippet, 'limit was 3');
});

test('search_writings defaults to ten results', async () => {
  const result = await callTool('search_writings', { query: 'hello' });

  assert.equal(JSON.parse(result.content[0].text)[0].snippet, 'limit was 10');
});

test('list_initiatives returns published initiatives with URLs', async () => {
  const result = await callTool('list_initiatives');
  const initiatives = JSON.parse(result.content[0].text);

  assert.equal(initiatives[0].slug, 'superbloom');
  assert.equal(initiatives[0].url, `${site.origin}/initiatives/superbloom`);
});

test('brew_coffee is refused with a 418 tool error', async () => {
  const result = await callTool('brew_coffee');

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /418/);
  assert.match(result.content[0].text, /teapot/i);
});

test('summarizeWriting accepts a Date or the string a cache hands back', () => {
  const base = { slug: 'a', title: 'A', description: 'd', tags: [] };

  assert.equal(
    summarizeWriting({ ...base, published: new Date('2026-05-01T00:00:00Z') })
      .published,
    '2026-05-01T00:00:00.000Z'
  );
  assert.equal(
    summarizeWriting({ ...base, published: '2026-05-01T00:00:00.000Z' })
      .published,
    '2026-05-01T00:00:00.000Z'
  );
});
