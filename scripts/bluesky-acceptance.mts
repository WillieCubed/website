import type {} from '@atcute/atproto';
import type {} from '@atcute/bluesky';
import { Client, ok } from '@atcute/client';
import type { Did, Nsid, ResourceUri } from '@atcute/lexicons';
import { PasswordSession } from '@atcute/password-session';
import { now } from '@atcute/tid';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';

import type { DocumentSource } from '../lib/atproto/records';
import type { RepoClient } from '../lib/atproto/types';
import type { PublishingResponse } from '../lib/indieweb/types';
import type { WritingData } from '../lib/writings/types';

let phase = 'arguments';
let failurePath: string | undefined;
async function retryDidResolution<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.name !== 'FailedDocumentResolutionError' ||
        attempt === 2
      )
        throw error;
      await new Promise((finish) => setTimeout(finish, (attempt + 1) * 1000));
    }
  }
}
async function main() {
  const { values } = parseArgs({
    options: {
      env: { type: 'string', default: '.env.standard-test.local' },
      receipt: {
        type: 'string',
        default: `.playwright-mcp/bluesky-live-${Date.now()}.json`,
      },
      write: { type: 'boolean', default: false },
      cleanup: { type: 'boolean', default: false },
    },
  });
  failurePath = `${values.receipt}.failure.json`;
  phase = 'credential and isolation checks';
  try {
    Object.assign(process.env, parseEnv(await readFile(values.env!, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (values.write && !values.cleanup) {
    try {
      await readFile(values.receipt!, 'utf8');
      throw new Error(
        'The receipt already exists. Choose another --receipt path or resume --cleanup first.'
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  if (process.env.POSTGRES_URL) {
    const dbUrl = new URL(process.env.POSTGRES_URL);
    assert(
      /^ep-winter-wind-b5iiaxe7(?:-pooler)?\.c-7\.us-east-2\.aws\.neon\.tech$/.test(
        dbUrl.hostname
      ),
      'Only the verified isolated acceptance Neon host is permitted.'
    );
  }
  const did = process.env.NEXT_PUBLIC_ATPROTO_DID;
  assert(
    did && did !== 'did:plc:iyn6nc3ffqm2e3555exyrgvv',
    'A separate acceptance DID is required. Run scripts/publishing-acceptance-setup.mts. The production owner is forbidden.'
  );
  assert.equal(
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, ''),
    'https://indieweb-acceptance.vercel.app'
  );
  assert(process.env.ATPROTO_PUBLICATION_RKEY);
  assert(
    process.env.ATPROTO_APP_PASSWORD,
    'The isolated account publishing credential is missing.'
  );
  if (!values.write && !values.cleanup) {
    console.log(
      'Preflight passed. No writes occurred. --write requires an empty isolated acceptance publication on the acceptance branch.'
    );
    process.exit(0);
  }
  assert(
    /^codex\/publishing-compatibility-acceptance(?:-\d{8})?$/.test(
      execFileSync('git', ['branch', '--show-current'], {
        encoding: 'utf8',
      }).trim()
    ),
    'Live writes require the isolated acceptance branch.'
  );
  phase = 'module loading';
  const [
    config,
    { resolvePds },
    { createRepoClient },
    { syncAtproto },
    copies,
    { documentRkey },
    { fetchBlueskyResponses: fetchResponses },
  ] = await Promise.all([
    import('../lib/atproto/config'),
    import('../lib/atproto/identity'),
    import('../lib/atproto/client'),
    import('../lib/atproto/sync'),
    import('../lib/atproto/bluesky'),
    import('../lib/atproto/keys'),
    import('../lib/atproto/responses'),
  ]);
  async function fetchBlueskyResponses(writing: WritingData) {
    const result = await fetchResponses(writing);
    assert(
      !result.incomplete,
      'Incomplete response reads cannot establish import or deletion.'
    );
    return result;
  }
  const { publicationUri, publicationRkey } = config.publishingIdentity();
  phase = 'public DID resolution';
  const pds = await retryDidResolution(() => resolvePds(did as Did));
  phase = 'acceptance account sign-in';
  const session = await PasswordSession.login({
    service: pds,
    identifier: did,
    password: process.env.ATPROTO_APP_PASSWORD,
  });
  assert.equal(session.did, did);
  const rpc = new Client({ handler: session });
  phase = 'publishing client sign-in';
  const baseClient = await retryDidResolution(() =>
    createRepoClient(process.env.ATPROTO_APP_PASSWORD!)
  ).catch(async (error: unknown) => {
    await session.logout();
    throw error;
  });
  const get = baseClient.getRecord!;
  interface Receipt {
    version: 1;
    did: string;
    pds: string;
    publicationUri: string;
    started: string;
    owned: {
      collection: string;
      rkey: string;
      values?: Record<string, unknown>[];
    }[];
    originalPublication: Record<string, unknown> | null;
    publicationValues?: Record<string, unknown>[];
    checks: { name: string; observedAt: string; details?: unknown }[];
    cleanup: 'pending' | 'passed' | 'failed';
    error?: string;
  }
  let receipt: Receipt;
  let journalWrites = Promise.resolve();
  async function save() {
    journalWrites = journalWrites.then(async () => {
      await mkdir(dirname(values.receipt!), { recursive: true });
      await writeFile(
        values.receipt!,
        JSON.stringify(receipt, null, 2) + '\n',
        {
          mode: 0o600,
        }
      );
      await chmod(values.receipt!, 0o600);
    });
    await journalWrites;
  }
  async function checked(name: string, details?: unknown) {
    receipt.checks.push({
      name,
      observedAt: new Date().toISOString(),
      details,
    });
    await save();
    console.log(`Passed: ${name}.`);
  }
  async function reserve(collection: string, rkey = now()) {
    assert.equal(
      await get(collection, rkey),
      null,
      'Reserved key already exists.'
    );
    receipt.owned.push({ collection, rkey, values: [] });
    await save();
    return rkey;
  }
  async function intent(
    collection: string,
    rkey: string,
    value: Record<string, unknown>
  ) {
    const owned = receipt.owned.find(
      (entry) => entry.collection === collection && entry.rkey === rkey
    );
    if (owned) (owned.values ??= []).push(structuredClone(value));
    else {
      assert(
        collection === config.PUBLICATION_COLLECTION &&
          rkey === publicationRkey &&
          receipt.originalPublication,
        'Refuse a write outside the ownership journal.'
      );
      (receipt.publicationValues ??= []).push(structuredClone(value));
    }
    await save();
  }
  function journaled(real: RepoClient): RepoClient {
    return {
      ...real,
      async createRecord(collection, rkey, value) {
        await intent(collection, rkey, value);
        return real.createRecord!(collection, rkey, value);
      },
      async putRecord(collection, rkey, value, swapRecord) {
        await intent(collection, rkey, value);
        return real.putRecord!(collection, rkey, value, swapRecord);
      },
      async applyWrites(writes) {
        for (const write of writes)
          if ('value' in write)
            await intent(
              write.collection,
              write.rkey,
              write.value as Record<string, unknown>
            );
        return real.applyWrites(writes);
      },
    };
  }
  const client = journaled(baseClient);
  async function create(
    collection: string,
    record: Record<string, unknown>,
    rkey = now()
  ) {
    await reserve(collection, rkey);
    const created = await client.createRecord!(collection, rkey, record);
    return { uri: created.uri, cid: created.cid };
  }
  async function remove(collection: string, rkey: string) {
    const current = await get(collection, rkey);
    if (current) {
      const owned = receipt.owned.find(
        (entry) => entry.collection === collection && entry.rkey === rkey
      );
      assert(
        owned?.values?.some((value) => {
          try {
            assert.deepEqual(value, current.value);
            return true;
          } catch {
            return false;
          }
        }),
        'The owned record changed; preserve it for guarded recovery.'
      );
      await ok(
        rpc.post('com.atproto.repo.deleteRecord', {
          input: {
            repo: did as Did,
            collection: collection as Nsid,
            rkey,
            swapRecord: current.cid,
          },
        })
      );
    }
  }
  async function cleanup() {
    for (const record of [...receipt.owned].reverse())
      await remove(record.collection, record.rkey);
    const current = await get(config.PUBLICATION_COLLECTION, publicationRkey);
    if (receipt.originalPublication && current) {
      assert(
        [
          receipt.originalPublication,
          ...(receipt.publicationValues ?? []),
        ].some((value) => {
          try {
            assert.deepEqual(value, current.value);
            return true;
          } catch {
            return false;
          }
        }),
        'The preexisting publication changed outside this run.'
      );
      await baseClient.putRecord!(
        config.PUBLICATION_COLLECTION,
        publicationRkey,
        receipt.originalPublication,
        current.cid
      );
    }
    for (const record of receipt.owned)
      assert.equal(await get(record.collection, record.rkey), null);
    if (receipt.originalPublication)
      assert.deepEqual(
        (await get(config.PUBLICATION_COLLECTION, publicationRkey))?.value,
        receipt.originalPublication
      );
    if (process.env.POSTGRES_URL) {
      const { createPool } = await import('@vercel/postgres');
      const db = createPool({ max: 1 });
      try {
        for (const record of receipt.owned.filter(
          (entry) => entry.collection === 'app.bsky.feed.post'
        ))
          await db.sql`DELETE FROM atproto_response_observations WHERE copy_uri = ${`at://${did}/app.bsky.feed.post/${record.rkey}`}`;
      } finally {
        await db.end();
      }
    }
    receipt.cleanup = 'passed';
    await save();
  }
  async function appview(
    method: string,
    parameters: Record<string, string | string[]>
  ) {
    const url = new URL(`/xrpc/${method}`, config.blueskyAppview());
    for (const [key, value] of Object.entries(parameters)) {
      for (const item of Array.isArray(value) ? value : [value])
        url.searchParams.append(key, item);
    }
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    assert(
      response.ok,
      `Live AppView ${method} failed (${response.status}); unavailable data cannot prove absence.`
    );
    return response.json();
  }
  async function until(name: string, predicate: () => Promise<boolean>) {
    const deadline = Date.now() + 180000;
    do {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } while (Date.now() < deadline);
    throw new Error(`AppView did not confirm ${name} within 180 seconds.`);
  }

  phase = values.cleanup ? 'journaled cleanup' : 'empty-publication preflight';
  try {
    if (values.cleanup) {
      receipt = JSON.parse(await readFile(values.receipt!, 'utf8')) as Receipt;
      assert.equal(receipt.version, 1);
      assert.equal(receipt.did, did);
      assert.equal(receipt.publicationUri, publicationUri);
      assert(
        receipt.owned.every(
          (record) =>
            [
              'site.standard.publication',
              'site.standard.document',
              'app.bsky.feed.post',
              'app.bsky.feed.like',
              'app.bsky.feed.repost',
              'app.bsky.feed.threadgate',
            ].includes(record.collection) &&
            /^[234567a-z]{13}$/.test(record.rkey)
        ),
        'Invalid cleanup journal.'
      );
      await cleanup();
      console.log(
        'Cleanup passed. Every reserved record and response observation is absent.'
      );
    } else {
      console.log(
        `Step 1: Refuse production writes and existing acceptance documents. Account ${did}; PDS ${pds}.`
      );
      assert(
        !(await client.listRecords(config.DOCUMENT_COLLECTION)).some(
          (record) => record.value.site === publicationUri
        ),
        'Use an empty acceptance publication.'
      );
      const prior = await get(config.PUBLICATION_COLLECTION, publicationRkey);
      if (prior)
        assert.equal(prior.value.url, process.env.NEXT_PUBLIC_SITE_ORIGIN);
      const started = new Date();
      receipt = {
        version: 1,
        did,
        pds,
        publicationUri,
        started: started.toISOString(),
        owned: [],
        originalPublication: prior?.value ?? null,
        checks: [],
        cleanup: 'pending',
      };
      await save();
      if (!prior) await reserve(config.PUBLICATION_COLLECTION, publicationRkey);
      phase = 'real Bluesky lifecycle';
      let failure: unknown;
      try {
        const slug = `bluesky-acceptance-${started.getTime()}`;
        const source: DocumentSource = {
          slug,
          title: 'Disposable Bluesky acceptance check',
          description: 'This copy exists only during isolated acceptance.',
          published: started,
          lastUpdated: started,
          tags: [],
          body: 'Disposable acceptance body.',
        };
        const rkey = documentRkey(`/writings/${slug}`, started);
        await reserve(config.DOCUMENT_COLLECTION, rkey);
        await reserve('app.bsky.feed.post', rkey);
        const fetchImage = async () => null;
        console.log(
          'Step 2: Verify explicit opt-in, linked copies and immutable retries.'
        );
        await syncAtproto({ client, writings: [source], fetchImage });
        assert.equal(
          await get('app.bsky.feed.post', rkey),
          null,
          'A writing without opt-in must not announce.'
        );
        const requested = {
          ...source,
          syndicateTo: [`https://bsky.app/profile/${did}`],
        };
        const independent: RepoClient[] = [];
        let release!: () => void;
        let rejectBarrier!: (error: Error) => void;
        let absentReads = 0;
        const simultaneous = new Promise<void>((resolve, reject) => {
          release = resolve;
          rejectBarrier = reject;
        });
        void simultaneous.catch(() => {});
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
          for (let index = 0; index < 2; index++)
            independent.push(
              await retryDidResolution(() =>
                createRepoClient(process.env.ATPROTO_APP_PASSWORD!)
              )
            );
          deadline = setTimeout(
            () =>
              rejectBarrier(
                new Error('Concurrent real PDS reads did not meet.')
              ),
            30000
          );
          const concurrent = await Promise.allSettled(
            independent.map((real) => {
              const tracked = journaled(real);
              let firstRead = true;
              const simultaneousClient: RepoClient = {
                ...tracked,
                async getRecord(collection, key) {
                  const record = await tracked.getRecord!(collection, key);
                  if (
                    firstRead &&
                    collection === 'app.bsky.feed.post' &&
                    key === rkey &&
                    record === null
                  ) {
                    firstRead = false;
                    if (++absentReads === 2) release();
                    await simultaneous;
                  }
                  return record;
                },
              };
              return syncAtproto({
                client: simultaneousClient,
                writings: [requested],
                fetchImage,
              });
            })
          );
          assert.equal(absentReads, 2);
          assert(
            concurrent.every((result) => result.status === 'fulfilled'),
            'Concurrent first publishing must complete both real PDS writers.'
          );
          const reports = concurrent.flatMap((result) =>
            result.status === 'fulfilled' && result.value.status === 'synced'
              ? [result.value]
              : []
          );
          assert.equal(reports.length, 2);
          assert.equal(
            reports
              .flatMap((report) => report.announced)
              .filter((entry) => entry.action === 'create').length,
            1
          );
          await checked(
            'Concurrent independently authenticated first publishers create exactly one announcement',
            {
              writers: 2,
              absentPdsReads: absentReads,
              actions: reports
                .flatMap((report) => report.announced)
                .map((entry) => entry.action),
            }
          );
        } finally {
          if (deadline) clearTimeout(deadline);
          await Promise.all(independent.map((real) => real.close()));
        }
        const post = (await get('app.bsky.feed.post', rkey))!;
        const document = (await get(config.DOCUMENT_COLLECTION, rkey))!;
        assert.deepEqual(document.value.bskyPostRef, {
          uri: post.uri,
          cid: post.cid,
        });
        const embed = post.value.embed as {
          external: {
            uri: string;
            associatedRefs: { uri: string; cid: string }[];
          };
        };
        assert.equal(
          embed.external.uri,
          `${process.env.NEXT_PUBLIC_SITE_ORIGIN}/writings/${slug}`
        );
        assert.deepEqual(
          embed.external.associatedRefs.map((ref) => ref.uri),
          [document.uri, publicationUri]
        );
        assert(
          embed.external.associatedRefs.every(
            (ref) => typeof ref.cid === 'string'
          )
        );
        await checked(
          'No automatic post without intent; explicit copy links Standard document/publication',
          {
            post: { uri: post.uri, cid: post.cid },
            document: { uri: document.uri, cid: document.cid },
            associatedRefs: embed.external.associatedRefs,
          }
        );
        const repeated = await syncAtproto({
          client,
          writings: [requested],
          fetchImage,
        });
        assert(
          repeated.status === 'synced' &&
            repeated.announced.length === 0 &&
            repeated.writes.length === 0
        );
        const edited = {
          ...requested,
          title: 'Edited acceptance writing',
          body: 'Changed original body.',
          lastUpdated: new Date(started.getTime() + 1000),
        };
        await syncAtproto({ client, writings: [edited], fetchImage });
        assert.deepEqual(await get('app.bsky.feed.post', rkey), post);
        await checked(
          'Repeated and edited publications keep exactly one immutable announcement'
        );
        const interrupted = (await get(config.DOCUMENT_COLLECTION, rkey))!;
        const unassociated = { ...interrupted.value };
        delete unassociated.bskyPostRef;
        await client.putRecord!(
          config.DOCUMENT_COLLECTION,
          rkey,
          unassociated,
          interrupted.cid
        );
        const recovery = await syncAtproto({
          client,
          writings: [edited],
          fetchImage,
        });
        assert(
          recovery.status === 'synced' &&
            recovery.announced.some((entry) => entry.action === 'recover')
        );
        assert.deepEqual(await get('app.bsky.feed.post', rkey), post);
        await checked(
          'Interrupted association recovers the original deterministic post'
        );

        console.log(
          'Step 3: Associate a real manually supplied copy without creating a second post.'
        );
        const manualSource: DocumentSource = {
          ...source,
          slug: slug + '-manual',
        };
        const manualDocumentKey = documentRkey(
          `/writings/${manualSource.slug}`,
          started
        );
        await reserve(config.DOCUMENT_COLLECTION, manualDocumentKey);
        const manualPost = await create('app.bsky.feed.post', {
          $type: 'app.bsky.feed.post',
          text: 'Manually supplied acceptance copy',
          createdAt: started.toISOString(),
          embed: {
            $type: 'app.bsky.embed.external',
            external: {
              uri: `${process.env.NEXT_PUBLIC_SITE_ORIGIN}/writings/${manualSource.slug}`,
              title: manualSource.title,
              description: manualSource.description,
            },
          },
        });
        const listed = {
          ...manualSource,
          syndication: [
            { name: 'Bluesky', url: copies.blueskyPostUrl(manualPost.uri) },
          ],
          syndicateTo: requested.syndicateTo,
        };
        const associated = await syncAtproto({
          client,
          writings: [edited, listed],
          fetchImage,
        });
        assert(
          associated.status === 'synced' &&
            associated.announced.some((entry) => entry.action === 'associate')
        );
        assert.equal(await get('app.bsky.feed.post', manualDocumentKey), null);
        assert.deepEqual(
          (await get(config.DOCUMENT_COLLECTION, manualDocumentKey))?.value
            .bskyPostRef,
          manualPost
        );
        await checked(
          'Manual-copy association prevents a duplicate announcement',
          manualPost
        );
        const { loadOwnedAcceptanceIdentities } =
          await import('./atproto-acceptance-identities.mts');
        const identities = await loadOwnedAcceptanceIdentities(
          process.env.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
          did
        );
        assert(
          identities.visitor.did !== did &&
            identities.visitor.did !== 'did:plc:iyn6nc3ffqm2e3555exyrgvv'
        );
        const wrongBacklink = await create('app.bsky.feed.post', {
          $type: 'app.bsky.feed.post',
          text: 'This owned post deliberately does not link to the writing.',
          createdAt: started.toISOString(),
        });
        async function snapshot() {
          return Promise.all(
            (
              [
                config.PUBLICATION_COLLECTION,
                config.DOCUMENT_COLLECTION,
                'app.bsky.feed.post',
              ] as const
            ).map(async (collection) => ({
              collection,
              records: await snapshotCollection(collection),
            }))
          );
        }
        async function snapshotCollection(collection: Nsid) {
          const records: { uri: string; cid: string; value: unknown }[] = [];
          let cursor: string | undefined;
          do {
            const page = await ok(
              rpc.get('com.atproto.repo.listRecords', {
                params: { repo: did as Did, collection, cursor, limit: 100 },
              })
            );
            records.push(...page.records);
            cursor = page.cursor;
          } while (cursor);
          return records.sort((a, b) => a.uri.localeCompare(b.uri));
        }
        const protectedRecords = await snapshot();
        for (const invalid of [
          {
            name: 'owner',
            ref: {
              uri: `at://${identities.visitor.did}/app.bsky.feed.post/${rkey}`,
              cid: post.cid,
            },
            error: /owned by the publication account/,
          },
          {
            name: 'CID',
            ref: { uri: manualPost.uri, cid: document.cid },
            error: /outdated record/,
          },
          {
            name: 'canonical backlink',
            ref: wrongBacklink,
            error: /link to the canonical writing/,
          },
        ]) {
          await assert.rejects(
            syncAtproto({
              client,
              writings: [
                edited,
                {
                  ...listed,
                  atproto: {
                    bskyPostRef: {
                      ...invalid.ref,
                      uri: invalid.ref.uri as ResourceUri,
                    },
                  },
                },
              ],
              fetchImage,
            }),
            invalid.error
          );
          assert.deepEqual(await snapshot(), protectedRecords);
          assert.equal(
            await get('app.bsky.feed.post', manualDocumentKey),
            null
          );
          await checked(
            `Invalid ${invalid.name} copy refuses publishing and leaves every PDS record/CID unchanged`
          );
        }

        console.log(
          'Step 4: Create real reply, nested reply, image reply, quote, like and repost records.'
        );
        const ref = { uri: post.uri, cid: post.cid };
        const base = {
          $type: 'app.bsky.feed.post',
          createdAt: new Date().toISOString(),
        };
        const reply = await create('app.bsky.feed.post', {
          ...base,
          text: 'Disposable real reply.',
          reply: { root: ref, parent: ref },
        });
        const nested = await create('app.bsky.feed.post', {
          ...base,
          text: 'Disposable nested reply.',
          reply: { root: ref, parent: reply },
        });
        const bytes = await readFile('public/brand/social/avatar-400.png');
        const uploaded = await ok(
          rpc.post('com.atproto.repo.uploadBlob', {
            input: bytes,
            headers: { 'content-type': 'image/png' },
          })
        );
        const image = await create('app.bsky.feed.post', {
          ...base,
          text: 'Disposable image reply.',
          reply: { root: ref, parent: ref },
          embed: {
            $type: 'app.bsky.embed.images',
            images: [
              { alt: 'WillieCubed acceptance image', image: uploaded.blob },
            ],
          },
        });
        const quote = await create('app.bsky.feed.post', {
          ...base,
          text: 'Disposable real quote.',
          embed: { $type: 'app.bsky.embed.record', record: ref },
        });
        const like = await create('app.bsky.feed.like', {
          $type: 'app.bsky.feed.like',
          subject: ref,
          createdAt: new Date().toISOString(),
        });
        const repost = await create('app.bsky.feed.repost', {
          $type: 'app.bsky.feed.repost',
          subject: ref,
          createdAt: new Date().toISOString(),
        });
        const writing: WritingData = {
          ...source,
          hasExplicitTitle: true,
          people: [],
          draft: false,
          featured: false,
          readingTime: 1,
          postType: 'article',
        };
        let observed = await fetchBlueskyResponses(writing);
        await until('real response import', async () => {
          observed = await fetchBlueskyResponses(writing);
          const groups = observed.groups;
          return (
            [reply.uri, nested.uri, image.uri].every((uri) =>
              groups.replies.some((entry) => entry.id === uri)
            ) &&
            groups.mentions.some((entry) => entry.id === quote.uri) &&
            groups.likes.some(
              (entry) => entry.id === `like:${did}:${post.uri}`
            ) &&
            groups.reposts.some(
              (entry) => entry.id === `repost:${did}:${post.uri}`
            )
          );
        });
        assert.equal(
          observed.groups.replies.find((entry) => entry.id === nested.uri)
            ?.threadDepth,
          1
        );
        assert(
          observed.groups.replies
            .find((entry) => entry.id === image.uri)
            ?.media?.some(
              (entry) =>
                entry.kind === 'image' &&
                entry.description === 'WillieCubed acceptance image'
            )
        );
        assert(
          observed.groups.replies.every(
            (entry) =>
              entry.origin === 'atproto' &&
              entry.author.url === `https://bsky.app/profile/${did}`
          )
        );
        await checked(
          'Real AppView imports threading, image description, identity, quote, like and repost',
          {
            groups: Object.fromEntries(
              Object.entries(observed.groups).map(([key, entries]) => [
                key,
                entries.map((entry: PublishingResponse) => ({
                  id: entry.id,
                  source: entry.sourceUrl,
                })),
              ])
            ),
          }
        );

        console.log(
          'Step 5: Verify current PDS edits and AppView moderation/deletion through fresh reads.'
        );
        const replyRecord = (await get(
          'app.bsky.feed.post',
          reply.uri.split('/').at(-1)!
        ))!;
        const editedReply = {
          ...replyRecord.value,
          text: 'Edited real reply.',
        };
        await client.putRecord!(
          'app.bsky.feed.post',
          reply.uri.split('/').at(-1)!,
          editedReply,
          replyRecord.cid
        );
        await until('current PDS reply edit refresh', async () => {
          const current = await get(
            'app.bsky.feed.post',
            reply.uri.split('/').at(-1)!
          );
          assert(current && current.cid !== replyRecord.cid);
          assert.deepEqual(current.value, editedReply);
          return (await fetchBlueskyResponses(writing)).groups.replies.some(
            (entry) =>
              entry.id === reply.uri && entry.content === 'Edited real reply.'
          );
        });
        await create(
          'app.bsky.feed.threadgate',
          {
            $type: 'app.bsky.feed.threadgate',
            post: post.uri,
            createdAt: new Date().toISOString(),
            hiddenReplies: [image.uri],
          },
          rkey
        );
        await until('hidden reply moderation', async () => {
          const live = await appview('app.bsky.feed.getPostThread', {
            uri: post.uri,
            depth: '100',
            parentHeight: '0',
          });
          assert.equal(live.thread?.post?.uri, post.uri);
          const groups = (await fetchBlueskyResponses(writing)).groups;
          return (
            live.threadgate?.record?.hiddenReplies?.includes(image.uri) &&
            groups.replies.some((entry) => entry.id === reply.uri) &&
            !groups.replies.some((entry) => entry.id === image.uri)
          );
        });
        await remove('app.bsky.feed.threadgate', rkey);
        await until('visible reply restoration', async () =>
          (await fetchBlueskyResponses(writing)).groups.replies.some(
            (entry) => entry.id === image.uri
          )
        );
        const control = await create('app.bsky.feed.post', {
          ...base,
          text: 'Surviving real control reply.',
          reply: { root: ref, parent: ref },
        });
        await until('surviving control reply is indexed', async () =>
          (await fetchBlueskyResponses(writing)).groups.replies.some(
            (entry) => entry.id === control.uri
          )
        );
        for (const record of [reply, nested, image, quote, like, repost]) {
          const [, , , collection, key] = record.uri.split('/');
          await remove(collection, key);
        }
        const deletedUris = [reply.uri, nested.uri, image.uri, quote.uri];
        await until('deleted responses disappear', async () => {
          const [posts, likes, reposts, quotes] = await Promise.all([
            appview('app.bsky.feed.getPosts', {
              uris: [post.uri, control.uri, ...deletedUris],
            }),
            appview('app.bsky.feed.getLikes', { uri: post.uri }),
            appview('app.bsky.feed.getRepostedBy', { uri: post.uri }),
            appview('app.bsky.feed.getQuotes', { uri: post.uri }),
          ]);
          assert(
            Array.isArray(posts.posts) &&
              Array.isArray(likes.likes) &&
              Array.isArray(reposts.repostedBy) &&
              Array.isArray(quotes.posts)
          );
          const visible = new Set(
            posts.posts.map((entry: { uri: string }) => entry.uri)
          );
          const groups = (await fetchBlueskyResponses(writing)).groups;
          return (
            visible.has(post.uri) &&
            visible.has(control.uri) &&
            deletedUris.every((uri) => !visible.has(uri)) &&
            !likes.likes.some(
              (entry: { actor: { did: string } }) => entry.actor.did === did
            ) &&
            !reposts.repostedBy.some(
              (entry: { did: string }) => entry.did === did
            ) &&
            !quotes.posts.some(
              (entry: { uri: string }) => entry.uri === quote.uri
            ) &&
            groups.replies.some((entry) => entry.id === control.uri) &&
            !Object.values(groups)
              .flat()
              .some(
                (entry: PublishingResponse) =>
                  deletedUris.includes(entry.id) ||
                  entry.id === `like:${did}:${post.uri}` ||
                  entry.id === `repost:${did}:${post.uri}`
              )
          );
        });
        await checked(
          'Current PDS edits import after AppView discovery; AppView hidden, restored and deleted responses refresh'
        );
        await syncAtproto({ client, writings: [], fetchImage });
        assert.equal(await get(config.DOCUMENT_COLLECTION, rkey), null);
        assert.deepEqual(await get('app.bsky.feed.post', rkey), post);
        await checked(
          'Unpublishing removes the Standard document and preserves its existing Bluesky copy'
        );
      } catch (error) {
        failure = error;
        receipt.error = error instanceof Error ? error.message : String(error);
      }
      console.log(
        'Step 6: Remove all reserved posts, reactions, documents and observations.'
      );
      try {
        await cleanup();
      } catch (error) {
        receipt.cleanup = 'failed';
        receipt.error = `${receipt.error ?? ''} Cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
        await save();
        throw new Error(
          `Cleanup failed. Retry --cleanup --receipt ${values.receipt}.`,
          { cause: error }
        );
      }
      if (failure) throw failure;
      console.log(
        `Real Bluesky acceptance passed. Receipt: ${values.receipt}. Rendered hosted-page checks remain separate.`
      );
    }
  } finally {
    await client.close();
    await session.logout();
  }
}
await main().catch(async (error: unknown) => {
  if (failurePath) {
    await mkdir(dirname(failurePath), { recursive: true });
    await writeFile(
      failurePath,
      JSON.stringify(
        {
          phase,
          observedAt: new Date().toISOString(),
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { name: 'UnknownError' },
        },
        null,
        2
      ) + '\n',
      { mode: 0o600 }
    );
    await chmod(failurePath, 0o600);
  }
  console.error(
    `Real acceptance verification failed during ${phase}. Check the private receipt and failure journal before retrying. Credentials and provider request details are withheld.`
  );
  process.exitCode = 1;
});
