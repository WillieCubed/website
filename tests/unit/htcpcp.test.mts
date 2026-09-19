import assert from 'node:assert/strict';
import test from 'node:test';

import { coffeeResponse, teaResponse } from '@/lib/htcpcp';
import { site } from '@/lib/site';

function post(path: string, body: string, headers: Record<string, string>) {
  return new Request(`${site.origin}${path}`, {
    method: 'POST',
    headers,
    body,
  });
}

const TEAPOT_MESSAGE = { 'Content-Type': 'message/teapot' };

test('GET /coffee is refused with 418 because this server is a teapot', async () => {
  const response = coffeeResponse(new Request(`${site.origin}/coffee`));

  assert.equal(response.status, 418);
  const body = await response.text();
  assert.match(body, /I'm a teapot/);
  assert.match(body, /\/tea/);
});

test('POST /coffee with a coffeepot message is still 418', async () => {
  const response = coffeeResponse(
    post('/coffee', 'start', { 'Content-Type': 'message/coffeepot' })
  );

  assert.equal(response.status, 418);
});

test('GET /tea describes the pot', async () => {
  const response = await teaResponse(new Request(`${site.origin}/tea`));

  assert.equal(response.status, 200);
  assert.match(await response.text(), /teapot/i);
});

test('POST /tea with "start" brews', async () => {
  const response = await teaResponse(post('/tea', 'start', TEAPOT_MESSAGE));

  assert.equal(response.status, 200);
  assert.match(await response.text(), /brewing/i);
});

test('POST /tea with "stop" stops', async () => {
  const response = await teaResponse(post('/tea', 'stop', TEAPOT_MESSAGE));

  assert.equal(response.status, 200);
  assert.match(await response.text(), /stopped/i);
});

test('POST /tea with any other message is a bad request', async () => {
  const response = await teaResponse(post('/tea', 'steep', TEAPOT_MESSAGE));

  assert.equal(response.status, 400);
});

test('POST /tea without a teapot message is an unsupported media type', async () => {
  const response = await teaResponse(
    post('/tea', 'start', { 'Content-Type': 'text/plain' })
  );

  assert.equal(response.status, 415);
});

test('POST /tea serves an addition from RFC 2324', async () => {
  const response = await teaResponse(
    post('/tea', 'start', {
      ...TEAPOT_MESSAGE,
      'Accept-Additions': 'Whole-milk',
    })
  );

  assert.equal(response.status, 200);
  assert.match(await response.text(), /Whole-milk/);
});

test('POST /tea refuses an addition the pot does not have with 406 and lists what it has', async () => {
  const response = await teaResponse(
    post('/tea', 'start', { ...TEAPOT_MESSAGE, 'Accept-Additions': 'Whisky' })
  );

  assert.equal(response.status, 406);
  const body = await response.text();
  assert.match(body, /Whisky/);
  assert.match(body, /Whole-milk/);
});

test('Accept-Additions ignores case and quality values', async () => {
  const response = await teaResponse(
    post('/tea', 'start', {
      ...TEAPOT_MESSAGE,
      'Accept-Additions': 'skim;q=0.5, Non-Dairy',
    })
  );

  assert.equal(response.status, 200);
});
