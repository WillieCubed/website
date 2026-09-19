import assert from 'node:assert/strict';
import test from 'node:test';

import { corsPreflight, withCors } from '@/lib/mcp/cors';
import { site } from '@/lib/site';

const endpoint = `${site.origin}/api/mcp`;

function preflight(requestHeaders?: string) {
  return corsPreflight(
    new Request(endpoint, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        ...(requestHeaders
          ? { 'Access-Control-Request-Headers': requestHeaders }
          : {}),
      },
    })
  );
}

test('the preflight answers 204 for any origin and allows GET and POST', () => {
  const response = preflight();

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(
    response.headers.get('Access-Control-Allow-Methods') ?? '',
    /GET/
  );
  assert.match(
    response.headers.get('Access-Control-Allow-Methods') ?? '',
    /POST/
  );
});

test('the preflight allows the headers the client asks for', () => {
  assert.equal(
    preflight('content-type, mcp-protocol-version').headers.get(
      'Access-Control-Allow-Headers'
    ),
    'content-type, mcp-protocol-version'
  );
});

test('the preflight allows the MCP headers when the client names none', () => {
  const allowed = preflight().headers.get('Access-Control-Allow-Headers') ?? '';

  assert.match(allowed, /content-type/i);
  assert.match(allowed, /accept/i);
  assert.match(allowed, /mcp-protocol-version/i);
});

test('withCors adds the origin header and keeps the response body, status, and type', async () => {
  const handler = withCors(
    async () =>
      new Response('data: {}\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
  );
  const response = await handler(new Request(endpoint, { method: 'POST' }));

  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'data: {}\n\n');
});
