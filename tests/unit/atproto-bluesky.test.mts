import assert from 'node:assert/strict';
import test from 'node:test';

import { syncBlueskyCopies } from '@/lib/atproto/bluesky';
import { publishingIdentity } from '@/lib/atproto/config';
import { documentRkey } from '@/lib/atproto/keys';
import type { DocumentSource } from '@/lib/atproto/records';
import type { RepoClient } from '@/lib/atproto/types';
import { absoluteUrl, site } from '@/lib/site';

const cid = 'bafyreifgg4ntz5pxvsdbaguqnz37qolup7kqlxztjaq5qy6cuddaptjcmi';
const source: DocumentSource = {
  slug: 'copy',
  title: 'A copy',
  description: 'Description',
  body: 'Body',
  tags: [],
  published: new Date('2026-10-07T00:00:00Z'),
  lastUpdated: new Date('2026-10-07T00:00:00Z'),
};
function repository() {
  const records = new Map<string, Record<string, unknown>>();
  const rkey = documentRkey('/writings/copy', source.published);
  const owner = publishingIdentity();
  records.set(`site.standard.publication/${owner.publicationRkey}`, {
    $type: 'site.standard.publication',
    name: 'Publication',
    url: site.origin,
  });
  records.set(`site.standard.document/${rkey}`, {
    $type: 'site.standard.document',
    site: owner.publicationUri,
    title: source.title,
    publishedAt: source.published.toISOString(),
  });
  let creates = 0,
    failAssociation = false;
  const reference = (collection: string, key: string) => ({
    uri: `at://${owner.did}/${collection}/${key}`,
    cid,
  });
  const client: RepoClient = {
    async listRecords() {
      return [];
    },
    async applyWrites() {},
    async uploadBlob() {},
    async close() {},
    async getRecord(collection, key) {
      const value = records.get(`${collection}/${key}`);
      return value ? { ...reference(collection, key), value } : null;
    },
    async createRecord(collection, key, value) {
      creates++;
      records.set(`${collection}/${key}`, value);
      return reference(collection, key);
    },
    async putRecord(collection, key, value) {
      if (failAssociation) throw new Error('PDS unavailable');
      records.set(`${collection}/${key}`, value);
    },
  };
  return {
    client,
    records,
    rkey,
    creates: () => creates,
    failAssociation: (value: boolean) => {
      failAssociation = value;
    },
  };
}
const requested = {
  ...source,
  syndicateTo: [
    site.syndication.find((entry) => entry.service === 'Bluesky')!.profile,
  ],
};

test('Bluesky copies require explicit writing intent and associate both Standard records', async () => {
  const repo = repository();
  await syncBlueskyCopies(repo.client, [source]);
  assert.equal(repo.creates(), 0);
  const first = await syncBlueskyCopies(repo.client, [requested]);
  assert.equal(first[0].action, 'create');
  assert.equal(
    first[0].post?.uri,
    `at://${publishingIdentity().did}/app.bsky.feed.post/${repo.rkey}`
  );
  const post = repo.records.get(`app.bsky.feed.post/${repo.rkey}`)!;
  const embed = post.embed as {
    external: { uri: string; associatedRefs: unknown[] };
  };
  assert.equal(embed.external.uri, absoluteUrl('/writings/copy'));
  assert.equal(embed.external.associatedRefs.length, 2);
  assert.equal(
    repo.records.get(`site.standard.document/${repo.rkey}`)?.bskyPostRef !==
      undefined,
    true
  );
  await syncBlueskyCopies(repo.client, [
    { ...requested, title: 'Changed title' },
  ]);
  assert.equal(repo.creates(), 1);
  assert.equal(post.text, source.title);
});
test('a retry recovers the existing copy after its document association failed', async () => {
  const repo = repository();
  repo.failAssociation(true);
  await assert.rejects(
    syncBlueskyCopies(repo.client, [requested]),
    /PDS unavailable/
  );
  repo.failAssociation(false);
  const recovered = await syncBlueskyCopies(repo.client, [requested]);
  assert.equal(recovered[0].action, 'recover');
  assert.equal(
    recovered[0].post?.uri,
    `at://${publishingIdentity().did}/app.bsky.feed.post/${repo.rkey}`
  );
  assert.equal(repo.creates(), 1);
});
test('missing Standard documents and occupied announcement keys fail without posting', async () => {
  const repo = repository();
  repo.records.delete(`site.standard.document/${repo.rkey}`);
  await assert.rejects(
    syncBlueskyCopies(repo.client, [requested]),
    /before syndicating/
  );
  assert.equal(repo.creates(), 0);
  const occupied = repository();
  occupied.records.set(`app.bsky.feed.post/${occupied.rkey}`, {
    embed: { external: { uri: 'https://other.example/' } },
  });
  await assert.rejects(
    syncBlueskyCopies(occupied.client, [requested]),
    /another post/
  );
  assert.equal(occupied.creates(), 0);
});

test('dry runs report requested copy actions before a Standard document exists', async () => {
  const repo = repository();
  repo.records.delete(`site.standard.document/${repo.rkey}`);
  assert.deepEqual(
    await syncBlueskyCopies(repo.client, [source], { dryRun: true }),
    []
  );
  const planned = await syncBlueskyCopies(repo.client, [requested], {
    dryRun: true,
  });
  assert.deepEqual(planned, [
    { action: 'create', url: absoluteUrl('/writings/copy'), post: null },
  ]);
  assert.equal(repo.creates(), 0);
});

test('listed copies reject unrelated or malformed owner posts before association', async () => {
  for (const value of [
    {
      $type: 'app.bsky.feed.post',
      text: 'Unrelated.',
      createdAt: source.published.toISOString(),
    },
    {
      $type: 'app.bsky.feed.post',
      text: 'Invalid date.',
      createdAt: 'invalid',
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: absoluteUrl('/writings/copy'),
          title: 'Copy',
          description: '',
        },
      },
    },
    {
      $type: 'app.bsky.feed.post',
      text: 'No valid link.',
      createdAt: source.published.toISOString(),
      facets: [
        {
          index: { byteStart: 0, byteEnd: 999 },
          features: [
            {
              $type: 'app.bsky.richtext.facet#link',
              uri: absoluteUrl('/writings/copy'),
            },
          ],
        },
      ],
    },
  ]) {
    const repo = repository();
    repo.records.set('app.bsky.feed.post/manual', value);
    const listed = {
      ...source,
      syndication: [
        {
          name: 'Bluesky',
          url: `${site.syndication.find((account) => account.service === 'Bluesky')!.serviceUrl}profile/${publishingIdentity().did}/post/manual`,
        },
      ],
    };
    await assert.rejects(
      syncBlueskyCopies(repo.client, [listed]),
      /canonical writing|valid Bluesky/
    );
    assert.equal(
      repo.records.get(`site.standard.document/${repo.rkey}`)?.bskyPostRef,
      undefined
    );
    assert.equal(repo.creates(), 0);
  }
});

test('manual link facets and embedded cards associate copies and report no repeated action', async () => {
  for (const backlink of [
    {
      facets: [
        {
          index: { byteStart: 0, byteEnd: 4 },
          features: [
            {
              $type: 'app.bsky.richtext.facet#link',
              uri: absoluteUrl('/writings/copy'),
            },
          ],
        },
      ],
    },
    {
      embed: {
        $type: 'app.bsky.embed.recordWithMedia',
        record: {
          $type: 'app.bsky.embed.record',
          record: {
            uri: `at://${publishingIdentity().did}/app.bsky.feed.post/quoted`,
            cid,
          },
        },
        media: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: absoluteUrl('/writings/copy'),
            title: 'Copy',
            description: '',
          },
        },
      },
    },
  ]) {
    const repo = repository();
    repo.records.set('app.bsky.feed.post/manual', {
      $type: 'app.bsky.feed.post',
      text: 'Copy',
      createdAt: source.published.toISOString(),
      ...backlink,
    });
    const listed = {
      ...source,
      syndication: [
        {
          name: 'Bluesky',
          url: `${site.syndication.find((account) => account.service === 'Bluesky')!.serviceUrl}profile/${publishingIdentity().did}/post/manual`,
        },
      ],
    };
    assert.deepEqual(
      await syncBlueskyCopies(repo.client, [listed], { dryRun: true }),
      [{ action: 'associate', url: absoluteUrl('/writings/copy'), post: null }]
    );
    const result = await syncBlueskyCopies(repo.client, [listed]);
    assert.equal(result[0].action, 'associate');
    assert.equal(
      result[0].post?.uri,
      `at://${publishingIdentity().did}/app.bsky.feed.post/manual`
    );
    assert.deepEqual(await syncBlueskyCopies(repo.client, [listed]), []);
  }
});

test('a lost create response recovers only the validated deterministic post', async () => {
  const repo = repository();
  const create = repo.client.createRecord!;
  repo.client.createRecord = async (...arguments_) => {
    await create(...arguments_);
    throw new Error('Response lost.');
  };
  const result = await syncBlueskyCopies(repo.client, [requested]);
  assert.equal(result[0].action, 'recover');
  assert.equal(
    result[0].post?.uri,
    `at://${publishingIdentity().did}/app.bsky.feed.post/${repo.rkey}`
  );
  assert.equal(repo.creates(), 1);
  assert.deepEqual(await syncBlueskyCopies(repo.client, [requested]), []);
});
