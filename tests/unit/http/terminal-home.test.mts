import { proxy } from '@/proxy';
import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';
import test from 'node:test';

import { entries, products } from '@/lib/home/ventures';
import { terminalHome } from '@/lib/http/terminal-home';
import { site } from '@/lib/site/identity';

function request(
  headers: Record<string, string> = {},
  path = '/',
  method = 'GET'
) {
  return new NextRequest(`${site.origin}${path}`, { headers, method });
}

test('explicit plain text includes published descriptions without terminal controls', async () => {
  const response = await proxy(
    request({ 'User-Agent': 'curl/8.10.1', Accept: 'text/plain' })
  );
  const body = await response.text();
  assert.equal(
    response.headers.get('Content-Type'),
    'text/plain; charset=utf-8'
  );
  assert.ok(body.includes(site.name));
  assert.ok(body.includes(`❖ ${site.shortName}`));
  for (const venture of site.ventures) assert.ok(body.includes(venture.url));
  assert.ok(body.includes(site.author.email));
  const unwrapped = body.replace(/\s+/g, ' ');
  for (const id of ['lvbt', 'hypertext', 'rtc', 'transitmapper']) {
    assert.ok(unwrapped.includes(entries[id].detail.body[0]), id);
  }
  for (const product of Object.values(products)) {
    assert.ok(unwrapped.includes(product.detail.body[0]), product.name);
  }
  assert.ok(!body.includes('A directory for finding the helpers'));
  assert.doesNotMatch(body, /<!doctype|<html/i);
  assert.ok(
    [...body].every(
      (char) =>
        char === '\n' ||
        (char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    )
  );
  assert.ok(body.length < 5000);
  assert.ok(body.split('\n').every((line) => line.length <= 72));
});

test('ordinary curl uses only foreground color and emphasis escapes', async () => {
  const body = await terminalHome(
    request({ 'User-Agent': 'curl/8', Accept: '*/*' })
  )!.text();
  const esc = String.fromCharCode(27);
  assert.ok(body.includes(`${esc}[1;32m`));
  const clean = body.replaceAll(
    new RegExp(`${esc}\\[(?:0|1|1;32|36)m`, 'g'),
    ''
  );
  assert.ok(!clean.includes(esc), 'Only the approved SGR commands are emitted');
  assert.ok(clean.replace(/\s+/g, ' ').includes(entries.docket.detail.body[0]));
  assert.ok(clean.split('\n').every((line) => line.length <= 72));
  assert.ok(body.endsWith('\n'));
});

test('hidden organizations and projects are omitted without breaking either text format', async () => {
  for (const id of ['lvbt', 'hypertext', 'rtc', 'transitmapper']) {
    const saved = entries[id];
    // The hidden flag removes a venture from this registry at module load.
    delete entries[id];
    try {
      for (const accept of ['*/*', 'text/plain']) {
        const response = terminalHome(
          request({ 'User-Agent': 'curl/8', Accept: accept })
        );
        assert.ok(response, `${id}: ${accept} still gets a terminal response`);
        assert.equal(response.status, 200);
        const body = (await response.text()).replace(/\s+/g, ' ');
        assert.ok(
          !body.includes(saved.detail.body[0]),
          `${id} description is omitted`
        );
        assert.ok(body.includes(`❖ ${site.shortName}`));
        assert.ok(body.includes(products.docket.detail.body[0]));
      }
    } finally {
      entries[id] = saved;
    }
  }
});

test('Accept preferences override curl detection and honor specific exclusions', () => {
  for (const accept of [
    'text/html',
    'text/plain;q=0, */*',
    'text/html;q=1, text/plain;q=0.5',
    'application/json',
    'text/plain;charset=iso-8859-1;q=1, text/html;q=0.5',
    'text/plain;format=flowed;q=1, text/html;q=0.5',
    'text/plain;charset=utf-8;q=0, text/plain;q=1',
  ]) {
    assert.equal(
      terminalHome(request({ Accept: accept, 'User-Agent': 'curl/8' })),
      undefined,
      accept
    );
  }
  for (const accept of [
    'text/plain',
    'TEXT/PLAIN',
    'text/plain;q=1, text/html;q=0.5',
    'text/*;q=0.5, text/html;q=0',
    'text/plain; charset="UTF-8"',
  ]) {
    assert.ok(terminalHome(request({ Accept: accept })), accept);
  }
  assert.equal(terminalHome(request({ Accept: '*/*' })), undefined);
});

test('HTML overrides, app navigation, queries, other paths and methods bypass terminal output', () => {
  const curl = { 'User-Agent': 'curl/8', Accept: '*/*' };
  for (const headers of [
    { ...curl, 'X-Original': 'true' },
    { ...curl, RSC: '1' },
    { ...curl, 'Next-Router-Prefetch': '1' },
  ]) {
    assert.equal(terminalHome(request(headers)), undefined);
  }
  for (const path of ['/whoami', '/feed.xml', '/missing', '/?detail=lvbt']) {
    assert.equal(terminalHome(request(curl, path)), undefined);
  }
  assert.equal(terminalHome(request(curl, '/', 'POST')), undefined);
});

test('HEAD selects the same headers as GET and returns no body', async () => {
  const headers = { 'User-Agent': 'curl/8' };
  const get = terminalHome(request(headers))!;
  const head = terminalHome(request(headers, '/', 'HEAD'))!;
  assert.deepEqual([...head.headers], [...get.headers]);
  assert.equal(await head.text(), '');
});

test('both homepage representations declare negotiation and avoid shared caches', async () => {
  for (const headers of [{ Accept: 'text/html' }, { Accept: 'text/plain' }]) {
    const response = await proxy(request(headers));
    for (const field of ['Accept', 'User-Agent', 'X-Original']) {
      assert.ok(response.headers.get('Vary')?.includes(field));
    }
    assert.match(response.headers.get('Cache-Control') ?? '', /no-store/);
    assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
  }
});

test('curl cannot bypass private preview authentication', async () => {
  const saved = process.env.SITE_MODE;
  try {
    process.env.SITE_MODE = 'preview';
    const response = await proxy(
      request({ 'User-Agent': 'curl/8', Accept: 'text/plain' })
    );
    assert.notEqual(response.status, 200);
    assert.ok(!(await response.text()).includes(`❖ ${site.shortName}`));
  } finally {
    if (saved === undefined) delete process.env.SITE_MODE;
    else process.env.SITE_MODE = saved;
  }
});
