import assert from 'node:assert/strict';
import test from 'node:test';

import { plainPage } from '@/lib/plain-page';
import { site } from '@/lib/site';

function request(accept?: string) {
  return new Request(`${site.origin}/anywhere`, {
    headers: accept ? { Accept: accept } : {},
  });
}

test('plainPage answers a browser with escaped HTML and keeps the status', async () => {
  const response = plainPage(request('text/html,application/xhtml+xml'), {
    status: 418,
    title: "418 I'm a teapot",
    lines: ['<script>alert(1)</script>'],
  });

  assert.equal(response.status, 418);
  assert.equal(
    response.headers.get('Content-Type'),
    'text/html; charset=utf-8'
  );

  const body = await response.text();
  assert.ok(!body.includes('<script>'));
  assert.match(body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.ok(
    body.includes(`<title>418 I&#39;m a teapot · ${site.name}</title>`)
  );
  assert.match(body, /href="\/"/);
});

test('plainPage answers everything else with plain text', async () => {
  const response = plainPage(request('*/*'), {
    title: 'Hello',
    lines: ['one', '', 'two'],
  });

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('Content-Type'),
    'text/plain; charset=utf-8'
  );
  assert.equal(await response.text(), 'one\n\ntwo\n');
});

test('plainPage answers a client with no Accept header with plain text', () => {
  const response = plainPage(request(), { title: 'Hello', lines: ['hi'] });

  assert.equal(
    response.headers.get('Content-Type'),
    'text/plain; charset=utf-8'
  );
});

test('plainPage keeps caches and crawlers away from a per-visitor page', () => {
  const response = plainPage(request(), { title: 'Hello', lines: ['hi'] });

  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('Vary'), 'Accept');
});
