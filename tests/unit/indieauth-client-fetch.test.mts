import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo, LookupAddress } from 'node:net';
import test from 'node:test';

import {
  type AddressResolver,
  CLIENT_DOCUMENT_MAX_BYTES,
  type ClientDocumentFetch,
  createPublicOnlyLookup,
  fetchIndieAuthClient,
  isPublicAddress,
} from '@/lib/indieweb/indieauth-client';

const PUBLIC_V4 = '93.184.216.34';
const PUBLIC_V6 = '2606:2800:220:1:248:1893:25c8:1946';

/** A resolver over a fixed table; unknown names fail like NXDOMAIN. */
function resolverFor(
  table: Record<string, string[]>,
  calls: string[] = []
): AddressResolver {
  return async (hostname) => {
    calls.push(hostname);
    const addresses = table[hostname];
    if (!addresses)
      throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    return addresses.map((address) => ({
      address,
      family: address.includes(':') ? 6 : 4,
    }));
  };
}

/** A fetch that answers from a list of responses and records each URL. */
function scriptedFetch(responses: Response[]) {
  const urls: string[] = [];
  const fetch: ClientDocumentFetch = async (url, init) => {
    assert.equal(init.redirect, 'manual');
    urls.push(url);
    const response = responses.shift();
    assert.ok(response, `unexpected request to ${url}`);
    return response;
  };
  return { fetch, urls };
}

function redirect(location: string, status = 302) {
  return new Response(null, { status, headers: { Location: location } });
}

function clientJson(clientId: string, name = 'Public Client') {
  return new Response(
    JSON.stringify({
      client_id: clientId,
      client_name: name,
      redirect_uris: [`${clientId}callback`],
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

function lookupWith(
  resolve: AddressResolver,
  hostname: string,
  all: boolean
): Promise<{ error: Error | null; result: string | LookupAddress[] }> {
  const lookup = createPublicOnlyLookup(resolve);
  return new Promise((done) => {
    lookup(hostname, { all }, (error, result) => done({ error, result }));
  });
}

test('isPublicAddress refuses private, loopback, link-local, shared, multicast, reserved, and mapped addresses', () => {
  for (const address of [
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '100.127.255.254',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.8',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '[::1]',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    '::ffff:a9fe:a9fe',
    '64:ff9b::a9fe:a9fe',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fe80::1%en0',
    'ff02::1',
    '2001:db8::1',
    '2002:a9fe:a9fe::1',
    'not an address',
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  for (const address of [PUBLIC_V4, '8.8.8.8', '1.1.1.1', PUBLIC_V6]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test('the connection lookup refuses a name with any private address', async () => {
  const resolve = resolverFor({
    'metadata.example': ['169.254.169.254'],
    'intranet.example': ['10.0.0.5'],
    'loopback.example': ['::1'],
    'mixed.example': [PUBLIC_V4, '192.168.0.10'],
  });
  for (const hostname of [
    'metadata.example',
    'intranet.example',
    'loopback.example',
    'mixed.example',
  ]) {
    for (const all of [true, false]) {
      const { error } = await lookupWith(resolve, hostname, all);
      assert.match(String(error), /does not resolve to a public address/);
    }
  }
});

test('the connection lookup passes public addresses through', async () => {
  const resolve = resolverFor({ 'client.example': [PUBLIC_V4, PUBLIC_V6] });
  const all = await lookupWith(resolve, 'client.example', true);
  assert.equal(all.error, null);
  assert.deepEqual(all.result, [
    { address: PUBLIC_V4, family: 4 },
    { address: PUBLIC_V6, family: 6 },
  ]);
  const one = await lookupWith(resolve, 'client.example', false);
  assert.equal(one.error, null);
  assert.equal(one.result, PUBLIC_V4);
});

test('a client whose name resolves to a private address is never requested', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const address of [
    '169.254.169.254',
    '10.0.0.5',
    '100.64.1.1',
    'fd00::1',
  ]) {
    const { fetch, urls } = scriptedFetch([]);
    const client = await fetchIndieAuthClient('https://evil.example/', {
      resolve: resolverFor({ 'evil.example': [address] }),
      fetch,
    });
    assert.deepEqual(client, { redirectUris: [] });
    assert.deepEqual(urls, [], address);
  }
});

test('a client on a public address is fetched and read', async () => {
  const clientId = 'https://client.example/';
  const { fetch, urls } = scriptedFetch([clientJson(clientId)]);
  const client = await fetchIndieAuthClient(clientId, {
    resolve: resolverFor({ 'client.example': [PUBLIC_V4] }),
    fetch,
  });
  assert.deepEqual(urls, [clientId]);
  assert.equal(client.name, 'Public Client');
  assert.deepEqual(client.redirectUris, [`${clientId}callback`]);
});

test('a redirect to a private host is refused', async (t) => {
  t.mock.method(console, 'error', () => {});
  const resolve = resolverFor({
    'client.example': [PUBLIC_V4],
    'intranet.example': ['10.0.0.5'],
  });
  for (const location of [
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1:3000/',
    'http://[::ffff:a9fe:a9fe]/',
    'http://localhost/',
    'https://intranet.example/',
    'file:///etc/passwd',
  ]) {
    const { fetch, urls } = scriptedFetch([redirect(location)]);
    const client = await fetchIndieAuthClient('https://client.example/', {
      resolve,
      fetch,
    });
    assert.deepEqual(client, { redirectUris: [] }, location);
    assert.deepEqual(urls, ['https://client.example/'], location);
  }
});

test('a redirect to a public host is followed and checked, three hops at most', async () => {
  const clientId = 'https://client.example/';
  const resolve = resolverFor({
    'client.example': [PUBLIC_V4],
    'www.client.example': [PUBLIC_V4],
  });
  const followed = scriptedFetch([
    redirect('https://www.client.example/', 301),
    clientJson(clientId),
  ]);
  const client = await fetchIndieAuthClient(clientId, {
    resolve,
    fetch: followed.fetch,
  });
  assert.equal(client.name, 'Public Client');
  assert.deepEqual(followed.urls, [clientId, 'https://www.client.example/']);

  const looping = scriptedFetch(
    Array.from({ length: 4 }, () => redirect('https://www.client.example/'))
  );
  const looped = await fetchIndieAuthClient(clientId, {
    resolve,
    fetch: looping.fetch,
  });
  assert.deepEqual(looped, { redirectUris: [] });
  assert.equal(looping.urls.length, 4);
});

test('an oversized client document is cut off without reading all of it', async () => {
  const chunk = new Uint8Array(64 * 1024).fill(0x20);
  let pulled = 0;
  let cancelled = false;
  const endless = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  const { fetch } = scriptedFetch([
    new Response(endless, { headers: { 'Content-Type': 'text/html' } }),
  ]);
  const client = await fetchIndieAuthClient('https://client.example/', {
    resolve: resolverFor({ 'client.example': [PUBLIC_V4] }),
    fetch,
  });
  assert.deepEqual(client, { redirectUris: [] });
  assert.ok(cancelled, 'the body stream was cancelled');
  assert.ok(
    pulled <= CLIENT_DOCUMENT_MAX_BYTES + 4 * chunk.byteLength,
    `read ${pulled} bytes`
  );

  const declared = scriptedFetch([
    new Response('{}', {
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(CLIENT_DOCUMENT_MAX_BYTES + 1),
      },
    }),
  ]);
  assert.deepEqual(
    await fetchIndieAuthClient('https://client.example/', {
      resolve: resolverFor({ 'client.example': [PUBLIC_V4] }),
      fetch: declared.fetch,
    }),
    { redirectUris: [] }
  );
});

test('a localhost client is not fetched and gets the defaults', async () => {
  for (const clientId of [
    'http://localhost:8080/',
    'http://127.0.0.1/',
    'http://[::1]/app',
  ]) {
    const { fetch, urls } = scriptedFetch([]);
    const client = await fetchIndieAuthClient(clientId, {
      resolve: resolverFor({}),
      fetch,
    });
    assert.deepEqual(client, { redirectUris: [] });
    assert.deepEqual(urls, [], clientId);
  }
});

test('a name that rebinds to loopback after the first check cannot connect', async (t) => {
  const errors = t.mock.method(console, 'error', () => {});
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.end('{}');
  });
  await new Promise<void>((listening) =>
    server.listen(0, '127.0.0.1', listening)
  );
  t.after(() => server.close());
  const { port } = server.address() as AddressInfo;

  // Public for the check before the request, loopback for the connection.
  const answers = [PUBLIC_V4, '127.0.0.1'];
  const calls: string[] = [];
  const resolve: AddressResolver = async (hostname) => {
    calls.push(hostname);
    const address = answers.shift() ?? '127.0.0.1';
    return [{ address, family: 4 }];
  };
  const client = await fetchIndieAuthClient(`http://rebind.example:${port}/`, {
    resolve,
  });
  assert.deepEqual(client, { redirectUris: [] });
  assert.equal(requests, 0);
  assert.ok(calls.length >= 2, 'the connection resolved the name itself');
  assert.match(
    String(errors.mock.calls.at(-1)?.arguments[1]?.cause ?? ''),
    /does not resolve to a public address/
  );
});
