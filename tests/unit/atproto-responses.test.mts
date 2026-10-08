import assert from 'node:assert/strict';
import test from 'node:test';

import {
  emptyResponses,
  mergeResponses,
  normalizeBlueskyPost,
  normalizeBlueskyReposts,
} from '@/lib/atproto/responses';
import { site } from '@/lib/site';

const uri =
  'at://did:plc:abcdefghijklmnopqrstuvwx/app.bsky.feed.post/3mwa5ei54c22g';
const post = {
  uri,
  author: {
    did: 'did:plc:abcdefghijklmnopqrstuvwx',
    handle: 'alice.example',
    displayName: 'Alice',
  },
  indexedAt: '2026-10-07T00:00:00Z',
  record: {
    $type: 'app.bsky.feed.post',
    text: 'A reply',
    createdAt: '2026-10-07T00:00:00Z',
  },
};
test('native replies preserve identity, source, date and gallery descriptions', () => {
  const response = normalizeBlueskyPost(
    {
      ...post,
      embed: {
        $type: 'app.bsky.embed.gallery#view',
        items: [
          {
            $type: 'app.bsky.embed.gallery#viewImage',
            fullsize: 'https://cdn.example/image.jpg',
            alt: 'A garden',
          },
        ],
      },
    },
    'https://example.com/writing',
    'reply'
  );
  assert.equal(response?.author.name, 'Alice');
  assert.equal(response?.origin, 'atproto');
  assert.equal(
    response?.publishedAt?.toISOString(),
    post.record.createdAt.replace('Z', '.000Z')
  );
  assert.deepEqual(response?.media, [
    {
      kind: 'image',
      url: 'https://cdn.example/image.jpg',
      description: 'A garden',
    },
  ]);
  assert.equal(response && 'isVerified' in response, false);
});
test('hidden, blocked, labelled or malformed replies never display', () => {
  assert.equal(
    normalizeBlueskyPost(post, 'https://example.com', 'reply', new Set([uri])),
    null
  );
  assert.equal(
    normalizeBlueskyPost(
      { ...post, author: { ...post.author, viewer: { blockedBy: true } } },
      'https://example.com',
      'reply'
    ),
    null
  );
  assert.equal(
    normalizeBlueskyPost(
      { ...post, labels: [{ val: '!hide' }] },
      'https://example.com',
      'reply'
    ),
    null
  );
  assert.ok(
    normalizeBlueskyPost(
      { ...post, labels: [{ val: 'custom-topic' }] },
      'https://example.com',
      'reply'
    )
  );
  assert.equal(
    normalizeBlueskyPost(
      { ...post, record: { ...post.record, createdAt: 'bad date' } },
      'https://example.com',
      'reply'
    ),
    null
  );
});
test('DID and handle copies of the same reply appear once', () => {
  const native = normalizeBlueskyPost(post, 'https://example.com', 'reply')!;
  const imported = emptyResponses();
  imported.replies.push(native);
  const mentions = emptyResponses();
  mentions.replies.push({
    ...native,
    id: 'webmention',
    origin: 'indieweb',
    sourceUrl: 'https://bsky.app/profile/alice.example/post/3mwa5ei54c22g',
  });
  const merged = mergeResponses(mentions, imported);
  assert.equal(merged.replies.length, 1);
  assert.equal(merged.replies[0].origin, 'indieweb');
});

test('response profile links and handle aliases follow the configured Bluesky service', () => {
  const account = site.syndication.find(
    (account) => account.service === 'Bluesky'
  )! as { serviceUrl: string };
  const previous = account.serviceUrl;
  account.serviceUrl = 'https://sky.example/app/';
  try {
    const response = normalizeBlueskyPost(
      post,
      'https://example.com/writing',
      'reply'
    )!;
    assert.equal(
      response.author.url,
      'https://sky.example/app/profile/did:plc:abcdefghijklmnopqrstuvwx'
    );
    assert.equal(
      response.sourceUrl,
      'https://sky.example/app/profile/did:plc:abcdefghijklmnopqrstuvwx/post/3mwa5ei54c22g'
    );
    assert.deepEqual(response.sourceAliases, [
      'https://sky.example/app/profile/alice.example/post/3mwa5ei54c22g',
    ]);
  } finally {
    account.serviceUrl = previous;
  }
});

test('native repost observations retain their first receipt without inventing an event date', async () => {
  const receipts = new Map<string, Date>();
  const observations = {
    async observe(copyUri: string, actorDids: string[]) {
      const output = new Map<string, Date>();
      for (const actorDid of actorDids) {
        const key = copyUri + ':' + actorDid;
        if (!receipts.has(key))
          receipts.set(key, new Date('2026-10-07T01:00:00Z'));
        output.set(actorDid, receipts.get(key)!);
      }
      return output;
    },
  };
  const first = await normalizeBlueskyReposts(
    [post.author],
    'https://example.com/writing',
    uri,
    { observations, now: new Date('2026-10-07T02:00:00Z') }
  );
  const refresh = await normalizeBlueskyReposts(
    [post.author],
    'https://example.com/writing',
    uri,
    { observations, now: new Date('2026-10-08T02:00:00Z') }
  );
  assert.equal(first[0].observedAt?.toISOString(), '2026-10-07T01:00:00.000Z');
  assert.equal(refresh[0].receivedAt.getTime(), first[0].receivedAt.getTime());
  assert.equal(refresh[0].publishedAt, undefined);
});

test('native repost facepiles survive unavailable receipts and omit durable dates', async () => {
  for (const observations of [
    null,
    {
      async observe() {
        throw new Error('Storage unavailable.');
      },
    },
  ]) {
    const responses = await normalizeBlueskyReposts(
      [
        post.author,
        { ...post.author, viewer: { blockedBy: true } },
        { ...post.author, did: 'invalid' },
      ],
      'https://example.com/writing',
      uri,
      { observations }
    );
    assert.equal(responses.length, 1);
    assert.equal(responses[0].author.name, 'Alice');
    assert.equal(responses[0].observedAt, undefined);
    assert.equal(responses[0].publishedAt, undefined);
  }
});
