import { CODEC_RAW, createSync, toString } from '@atcute/cid';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type CurrentResponseRecord,
  createResponseRecordReader,
  parseCurrentResponsePost,
} from '@/lib/atproto/response-records';
import {
  emptyResponses,
  mergeResponses,
  normalizeBlueskyPost,
  normalizeBlueskyReposts,
  refreshBlueskyCandidates,
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

const originalCid =
  'bafyreigsp4kj64xobl2sx7qz7e5kpg23tdkzz7lhkzwomzlatdfjwcdetq';
const editedCid = 'bafyreigurgtsrdb3uzxviqhz4e7swij4rc53zrjbd6nj7wfv6bn27ofvay';
const mediaCid = toString(
  createSync(CODEC_RAW, new TextEncoder().encode('Response media fixture'))
);
const copyUri = uri.replace('3mwa5ei54c22g', '3mwa5ei54c22h');
const target = 'https://example.com/writing';
const replyValue: CurrentResponseRecord['value'] = {
  $type: 'app.bsky.feed.post',
  text: 'Edited reply from its current PDS',
  createdAt: post.record.createdAt,
  reply: {
    root: { uri: copyUri, cid: originalCid },
    parent: { uri: copyUri, cid: originalCid },
  },
};
const discovered = {
  ...post,
  cid: originalCid,
  record: { ...replyValue, text: 'Original AppView reply' },
};
const currentReply: CurrentResponseRecord = {
  uri,
  cid: editedCid,
  value: replyValue,
  pds: 'https://pds.example/',
};
const candidate = {
  post: discovered,
  type: 'reply' as const,
  parentUri: copyUri,
};

test('stale AppView discovery displays the current PDS edit and omits a deleted record', async () => {
  const edited = await refreshBlueskyCandidates(
    [candidate],
    copyUri,
    target,
    new Set(),
    {
      reader: async () => currentReply,
    }
  );
  assert.equal(edited.incomplete, false);
  const response = normalizeBlueskyPost(
    edited.posts.get(uri)!,
    target,
    'reply'
  );
  assert.equal(response?.content, replyValue.text);
  assert.equal(edited.posts.get(uri)?.cid, editedCid);
  assert.equal(
    response?.parentUrl,
    'https://bsky.app/profile/did:plc:abcdefghijklmnopqrstuvwx/post/3mwa5ei54c22h'
  );
  const deleted = await refreshBlueskyCandidates(
    [candidate],
    copyUri,
    target,
    new Set(),
    {
      reader: async () => null,
    }
  );
  assert.equal(deleted.posts.size, 0);
  assert.equal(deleted.incomplete, false);
});

test('current PDS lookup cannot restore AppView-hidden, blocked, labelled or misidentified candidates', async () => {
  let reads = 0;
  const options = {
    reader: async () => {
      reads++;
      return currentReply;
    },
  };
  const hidden = await refreshBlueskyCandidates(
    [candidate],
    copyUri,
    target,
    new Set([uri]),
    options
  );
  assert.equal(hidden.posts.size, 0);
  for (const change of [
    { labels: [{ val: '!hide' }] },
    { author: { ...post.author, viewer: { blockedBy: true } } },
    { author: { ...post.author, did: 'did:plc:zzzzzzzzzzzzzzzzzzzzzzzz' } },
  ]) {
    const result = await refreshBlueskyCandidates(
      [{ ...candidate, post: { ...discovered, ...change } }],
      copyUri,
      target,
      new Set(),
      options
    );
    assert.equal(result.posts.size, 0);
  }
  assert.equal(reads, 0);
});

test('current source identity, schema, thread and self-label failures cannot show stale content', async () => {
  for (const change of [
    { uri: copyUri },
    { cid: 'invalid' },
    { pds: 'http://pds.example/' },
    { value: { ...replyValue, text: 1 } },
    {
      value: {
        ...replyValue,
        reply: { ...replyValue.reply!, parent: { uri, cid: originalCid } },
      },
    },
    {
      value: {
        ...replyValue,
        reply: { ...replyValue.reply!, root: { uri, cid: originalCid } },
      },
    },
    {
      value: {
        ...replyValue,
        labels: {
          $type: 'com.atproto.label.defs#selfLabels',
          values: [{ val: '!warn' }],
        },
      },
    },
  ]) {
    const result = await refreshBlueskyCandidates(
      [candidate],
      copyUri,
      target,
      new Set(),
      {
        reader: async () =>
          ({ ...currentReply, ...change }) as CurrentResponseRecord,
      }
    );
    assert.equal(result.posts.size, 0);
  }
  const failure = await refreshBlueskyCandidates(
    [candidate],
    copyUri,
    target,
    new Set(),
    {
      reader: async () => {
        throw new Error('PDS temporarily unavailable');
      },
    }
  );
  assert.equal(failure.posts.size, 0);
  assert.equal(failure.incomplete, true);
});

test('changed media uses the current PDS blob and descriptions; matching CIDs retain AppView media', async () => {
  const stale = {
    ...candidate,
    post: {
      ...discovered,
      embed: {
        $type: 'app.bsky.embed.images#view',
        images: [{ fullsize: 'https://cdn.example/old.png', alt: 'Old image' }],
      },
    },
  };
  const blob = {
    $type: 'blob' as const,
    ref: { $link: mediaCid },
    mimeType: 'image/png',
    size: 1,
  };
  const record: CurrentResponseRecord = {
    ...currentReply,
    value: {
      ...replyValue,
      embed: {
        $type: 'app.bsky.embed.images',
        images: [{ image: blob, alt: 'Current image' }],
      },
    },
  };
  const changed = await refreshBlueskyCandidates(
    [stale],
    copyUri,
    target,
    new Set(),
    { reader: async () => record }
  );
  const response = normalizeBlueskyPost(
    changed.posts.get(uri)!,
    target,
    'reply'
  );
  assert.equal(response?.media?.[0].description, 'Current image');
  const url = new URL(response!.media![0].url);
  assert.equal(url.origin, 'https://pds.example');
  assert.equal(url.pathname, '/xrpc/com.atproto.sync.getBlob');
  assert.equal(url.searchParams.get('did'), post.author.did);
  assert.equal(url.searchParams.get('cid'), mediaCid);
  const same = await refreshBlueskyCandidates(
    [stale],
    copyUri,
    target,
    new Set(),
    { reader: async () => ({ ...record, cid: originalCid }) }
  );
  assert.equal(
    normalizeBlueskyPost(same.posts.get(uri)!, target, 'reply')?.media?.[0].url,
    'https://cdn.example/old.png'
  );
  const malformed = await refreshBlueskyCandidates(
    [stale],
    copyUri,
    target,
    new Set(),
    {
      reader: async () =>
        ({
          ...record,
          value: {
            ...replyValue,
            embed: { $type: 'app.bsky.embed.video', video: blob },
          },
        }) as CurrentResponseRecord,
    }
  );
  assert.equal(malformed.posts.size, 0);
  const removed = await refreshBlueskyCandidates(
    [stale],
    copyUri,
    target,
    new Set(),
    { reader: async () => currentReply }
  );
  assert.deepEqual(
    normalizeBlueskyPost(removed.posts.get(uri)!, target, 'reply')?.media,
    []
  );
});

test('quote discovery requires the current record to keep quoting the original copy', async () => {
  const quote = { post: discovered, type: 'mention' as const };
  const record: CurrentResponseRecord = {
    ...currentReply,
    value: {
      ...replyValue,
      reply: undefined,
      embed: {
        $type: 'app.bsky.embed.record',
        record: { uri: copyUri, cid: originalCid },
      },
    },
  };
  const kept = await refreshBlueskyCandidates(
    [quote],
    copyUri,
    target,
    new Set(),
    { reader: async () => record }
  );
  assert.equal(kept.posts.size, 1);
  const moved = await refreshBlueskyCandidates(
    [quote],
    copyUri,
    target,
    new Set(),
    {
      reader: async () => ({
        ...record,
        value: {
          ...record.value,
          embed: {
            $type: 'app.bsky.embed.record',
            record: { uri, cid: originalCid },
          },
        },
      }),
    }
  );
  assert.equal(moved.posts.size, 0);
});

test('current record refresh bounds active reads to four and stops at its shared deadline', async () => {
  let active = 0;
  let maximum = 0;
  let reads = 0;
  const candidates = Array.from({ length: 8 }, (_, i) => ({
    ...candidate,
    post: { ...discovered, uri: uri + i },
  }));
  const result = await refreshBlueskyCandidates(
    candidates,
    copyUri,
    target,
    new Set(),
    {
      signal: AbortSignal.timeout(10),
      reader: async () => {
        reads++;
        maximum = Math.max(maximum, ++active);
        return new Promise<CurrentResponseRecord>(() => {});
      },
    }
  );
  assert.equal(maximum, 4);
  assert.equal(reads, 4);
  assert.equal(result.posts.size, 0);
  assert.equal(result.incomplete, true);
});

test('public current record reader resolves guarded HTTPS identity and distinguishes deletion from failure', async () => {
  let status = 200;
  let payload: unknown = { uri, cid: editedCid, value: replyValue };
  const requests: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url.href);
    assert(init?.signal);
    if (url.origin === 'https://plc.directory')
      return new Response(
        JSON.stringify({
          id: post.author.did,
          service: [
            {
              id: post.author.did + '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.example/',
            },
          ],
        }),
        { headers: { 'content-type': 'application/did+ld+json' } }
      );
    assert.equal(url.origin, 'https://pds.example');
    assert.equal(url.searchParams.get('repo'), post.author.did);
    assert.equal(url.searchParams.get('collection'), 'app.bsky.feed.post');
    assert.equal(url.searchParams.get('rkey'), uri.split('/').at(-1));
    return Response.json(payload, { status });
  };
  const read = createResponseRecordReader(
    new AbortController().signal,
    fetcher
  );
  assert.deepEqual(await read(uri), currentReply);
  status = 400;
  payload = { error: 'RecordNotFound' };
  assert.equal(await read(uri), null);
  status = 503;
  payload = { error: 'Unavailable' };
  await assert.rejects(read(uri), /unavailable/);
  status = 400;
  payload = { error: 'InvalidRequest' };
  await assert.rejects(read(uri), /unavailable/);
  status = 200;
  payload = { uri: copyUri, cid: editedCid, value: replyValue };
  await assert.rejects(read(uri), /another record/);
  assert.equal(
    requests.filter((url) => url.startsWith('https://plc.directory/')).length,
    1
  );
});

test('current media rebuilds playable MP4, gallery descriptions and contained links from typed records', async () => {
  const blob = {
    $type: 'blob' as const,
    ref: { $link: mediaCid },
    mimeType: 'video/mp4',
    size: 1,
  };
  const image = { ...blob, mimeType: 'image/jpeg' };
  const embeds: CurrentResponseRecord['value']['embed'][] = [
    { $type: 'app.bsky.embed.video', video: blob, alt: 'Current video' },
    {
      $type: 'app.bsky.embed.gallery',
      items: [
        {
          $type: 'app.bsky.embed.gallery#image',
          image,
          alt: 'Current gallery image',
          aspectRatio: { width: 1, height: 1 },
        },
      ],
    },
    {
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'https://files.example/current.pdf',
        title: 'Current PDF',
        description: 'Updated attachment',
      },
    },
    {
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'javascript:alert(1)',
        title: 'Executable URL',
        description: '',
      },
    },
  ];
  const expected = ['video', 'image', 'file', undefined];
  for (const [i, embed] of embeds.entries()) {
    const refreshed = await refreshBlueskyCandidates(
      [candidate],
      copyUri,
      target,
      new Set(),
      {
        reader: async () => ({
          ...currentReply,
          value: { ...replyValue, embed },
        }),
      }
    );
    const response = normalizeBlueskyPost(
      refreshed.posts.get(uri)!,
      target,
      'reply'
    );
    assert.equal(response?.media?.[0]?.kind, expected[i]);
    if (i < 2)
      assert.equal(
        new URL(response!.media![0].url).origin,
        'https://pds.example'
      );
    if (i === 0) assert.equal(response?.media?.[0].poster, undefined);
    if (i === 2) assert.equal(response?.media?.[0].description, 'Current PDF');
    if (i === 3) assert.deepEqual(response?.media, []);
  }
});

test('current record reader rejects HTTP PDS identities before requesting their records', async () => {
  let requests = 0;
  const read = createResponseRecordReader(
    new AbortController().signal,
    async () => {
      requests++;
      return new Response(
        JSON.stringify({
          id: post.author.did,
          service: [
            {
              id: post.author.did + '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'http://pds.example/',
            },
          ],
        }),
        { headers: { 'content-type': 'application/did+ld+json' } }
      );
    }
  );
  await assert.rejects(read(uri), /public HTTPS/);
  assert.equal(requests, 1);
});

test('legacy image and video replies retain prose and current blob media without an invented size', async () => {
  for (const mimeType of ['image/png', 'video/mp4']) {
    const legacy = { cid: mediaCid, mimeType };
    const embed: CurrentResponseRecord['value']['embed'] =
      mimeType === 'image/png'
        ? {
            $type: 'app.bsky.embed.images',
            images: [{ image: legacy, alt: 'Legacy image' }],
          }
        : { $type: 'app.bsky.embed.video', video: legacy, alt: 'Legacy video' };
    const value = { ...replyValue, embed };
    const normalized = parseCurrentResponsePost(value);
    const result = await refreshBlueskyCandidates(
      [candidate],
      copyUri,
      target,
      new Set(),
      {
        reader: async () => ({ ...currentReply, ...normalized }),
      }
    );
    const response = normalizeBlueskyPost(
      result.posts.get(uri)!,
      target,
      'reply'
    );
    assert.equal(response?.content, replyValue.text);
    assert.equal(
      response?.media?.[0].kind,
      mimeType === 'image/png' ? 'image' : 'video'
    );
    assert.equal(
      new URL(response!.media![0].url).searchParams.get('cid'),
      mediaCid
    );
    assert.deepEqual(normalized.legacyBlobCids, [mediaCid]);
    assert.equal('size' in legacy, false);
    const parsedEmbed = normalized.value.embed;
    if (parsedEmbed?.$type === 'app.bsky.embed.video')
      assert.equal(
        'size' in parsedEmbed.video ? parsedEmbed.video.size : undefined,
        -1
      );
    else if (parsedEmbed?.$type === 'app.bsky.embed.images')
      assert.equal(
        'size' in parsedEmbed.images[0].image
          ? parsedEmbed.images[0].image.size
          : undefined,
        -1
      );
  }
});

test('legacy CID/MIME failures and forged modern unknown sizes are rejected before media URLs', async () => {
  for (const blob of [
    { cid: 'invalid', mimeType: 'image/png' },
    { cid: originalCid, mimeType: 'image/png' },
    { cid: mediaCid, mimeType: 'text/html' },
    { cid: mediaCid, mimeType: '' },
    {
      $type: 'blob',
      ref: { $link: mediaCid },
      mimeType: 'image/png',
      size: -1,
    },
    { $type: 'blob', ref: { $link: mediaCid }, mimeType: 'image/png', size: 0 },
    {
      $type: 'blob',
      ref: { $link: mediaCid },
      mimeType: 'image/png',
      size: 2000001,
    },
  ]) {
    const result = await refreshBlueskyCandidates(
      [candidate],
      copyUri,
      target,
      new Set(),
      {
        reader: async () =>
          ({
            ...currentReply,
            value: {
              ...replyValue,
              embed: {
                $type: 'app.bsky.embed.images',
                images: [{ image: blob, alt: 'Rejected' }],
              },
            },
          }) as CurrentResponseRecord,
      }
    );
    assert.equal(result.posts.size, 0);
  }
});
