import assert from 'node:assert/strict';
import test from 'node:test';

import { createRepoClient } from '@/lib/atproto/client';
import { publishingIdentity } from '@/lib/atproto/config';

const cid = 'bafyreifgg4ntz5pxvsdbaguqnz37qolup7kqlxztjaq5qy6cuddaptjcmi';

test('created record references omit PDS commit and validation metadata', async (context) => {
  const owner = publishingIdentity();
  const document = {
    id: owner.did,
    service: [
      {
        id: `${owner.did}#atproto_pds`,
        type: 'AtprotoPersonalDataServer',
        serviceEndpoint: 'https://pds.example',
      },
    ],
  };
  const reference = {
    uri: `at://${owner.did}/app.bsky.feed.post/3mxfujg2qjsi7`,
    cid,
  };
  context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === 'https://plc.directory')
      return new Response(JSON.stringify(document), {
        headers: { 'content-type': 'application/did+ld+json' },
      });
    assert.equal(url.origin, 'https://pds.example');
    if (url.pathname === '/xrpc/com.atproto.server.createSession')
      return Response.json({
        did: owner.did,
        handle: 'owner.example',
        accessJwt: 'fixture-access',
        refreshJwt: 'fixture-refresh',
        didDoc: document,
        active: true,
      });
    if (url.pathname === '/xrpc/com.atproto.repo.createRecord')
      return Response.json({
        ...reference,
        commit: { cid, rev: '3mxfujilnfp2q' },
        validationStatus: 'valid',
      });
    assert.equal(url.pathname, '/xrpc/com.atproto.server.deleteSession');
    return new Response(null, { status: 200 });
  });
  const client = await createRepoClient('fixture-password');
  try {
    assert.deepEqual(
      await client.createRecord!('app.bsky.feed.post', '3mxfujg2qjsi7', {
        $type: 'app.bsky.feed.post',
        text: 'Copy',
        createdAt: '2026-10-08T00:00:00.000Z',
      }),
      reference
    );
  } finally {
    await client.close();
  }
});
