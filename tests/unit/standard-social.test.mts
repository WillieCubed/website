import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decryptOAuthValue,
  encryptOAuthValue,
} from '@/lib/atproto/oauth-crypto';
import {
  type GraphRepo,
  graphState,
  setGraphState,
} from '@/lib/atproto/social';

const uri =
  'at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/site.standard.publication/3khuwc44c222b';

test('OAuth storage encrypts credentials and rejects tampering and wrong keys', () => {
  const key = Buffer.alloc(32, 1).toString('base64');
  const data = {
    token: 'private-refresh-token',
    nested: { key: 'dpop-secret' },
  };
  const cipher = encryptOAuthValue(data, key);
  assert.ok(!cipher.includes(data.token));
  assert.deepEqual(decryptOAuthValue(cipher, key), data);
  assert.throws(() =>
    decryptOAuthValue(cipher, Buffer.alloc(32, 2).toString('base64'))
  );
  assert.throws(() => decryptOAuthValue(cipher.slice(0, -5), key));
});

test('social actions recognize other clients, retry safely, and undo every matching record', async () => {
  const records = [
    {
      uri: 'at://reader/site.standard.graph.subscription/external',
      value: { publication: uri },
    },
    {
      uri: 'at://reader/site.standard.graph.subscription/unrelated',
      value: { publication: 'at://other/publication/key' },
    },
  ];
  let created = 0;
  const repo: GraphRepo = {
    list: async () => records,
    create: async (collection, value) => {
      created++;
      records.push({ uri: `at://reader/${collection}/${created}`, value });
    },
    remove: async (_, rkey) => {
      records.splice(
        records.findIndex((r) => r.uri.endsWith('/' + rkey)),
        1
      );
    },
  };
  assert.equal(await graphState(repo, 'subscription', uri), true);
  await setGraphState(repo, 'subscription', uri, true);
  assert.equal(created, 0);
  records.push({
    uri: 'at://reader/site.standard.graph.subscription/duplicate',
    value: { publication: uri },
  });
  await setGraphState(repo, 'subscription', uri, false);
  assert.equal(await graphState(repo, 'subscription', uri), false);
  assert.equal(records.length, 1);
  await setGraphState(repo, 'subscription', uri, true);
  await setGraphState(repo, 'subscription', uri, true);
  assert.equal(created, 1);
  assert.equal(records[1].value.$type, 'site.standard.graph.subscription');
  assert.ok(records[1].value.createdAt);
});

test('a failed recommendation never reports success', async () => {
  const repo: GraphRepo = {
    list: async () => [],
    create: async () => {
      throw new Error('PDS unavailable');
    },
    remove: async () => {},
  };
  await assert.rejects(
    setGraphState(repo, 'recommendation', uri, true),
    /PDS unavailable/
  );
});
