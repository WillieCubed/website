# Bluesky Posting and Responses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a writing opts in through `syndicateTo`, the post-deploy sync
announces it on Bluesky once. The announcement is a link card that points back
at the writing's standard.site records. The writing page then shows the copy as
a `u-syndication` link, and shows Bluesky replies, likes, reposts and quotes
alongside its webmentions.

**Architecture:**

- **Posting** is a new step at the end of `syncAtproto()`, after the
  standard.site writes.
  - The post's record key is the document's own TID. A retried run therefore
    finds the post it already made instead of posting twice.
  - After posting, the sync updates the document with `bskyPostRef`. The PDS
    stays the only store, so nothing is committed to git.
- **The page** reads its document record from the PDS (cached for hours,
  tagged `atproto`) to find the copy. It reads the copy's thread from the
  public AppView (cached for minutes, tagged `bluesky`).
- **Responses** are mapped into the existing `WebmentionGroup`, so
  `WebmentionSection` renders one list of responses.
  - They are merged in the page only. The activity feeds and `/webmentions`
    stay webmention-only.

**Tech Stack:** The same as
[2026-10-02-standard-site.md](./2026-10-02-standard-site.md), plus
`@atcute/bluesky` ^4.0.22. It types `app.bsky.*`, including
`embed.external.associatedRefs`.

**Prerequisite:** PR B of the standard.site plan is merged. This plan edits
`lib/atproto/{types,plan,records,sync,client}.ts` and
`tests/unit/atproto-sync.test.mts` as they stand after that PR.

## Global Constraints

Everything in the standard.site plan's Global Constraints applies. In addition:

- **Never post to Bluesky from tests or dry runs.** Only `syncAtproto()` posts,
  only with `dryRun` false, and only where `ATPROTO_APP_PASSWORD` is set
  (Production).
- **No Bluesky address is hardcoded outside config.**
  - The AppView API comes from `BLUESKY_APPVIEW_URL`, read by
    `blueskyAppview()` in `lib/atproto/config.ts`. When it is unset,
    hand-posted copies are not resolved and responses are not shown.
  - The Bluesky web address is the configured account's `serviceUrl` in
    `lib/site.ts`.
  - The PDS comes from `resolvePds()`.
  - Tests build expected URLs from those values.
- **Announce only when** the writing's `syndicateTo` includes the Bluesky
  account's `profile`, **and** no Bluesky copy is known. A copy is known if
  the document has a `bskyPostRef`, or if `syndication` lists a Bluesky post
  URL. A listed copy blocks announcing even when it cannot be resolved.
- **Never edit or delete a Bluesky post from code.** Unpublishing a writing
  deletes its document record, but the post stays on Bluesky.
- **The post's record key is the document's record key**
  (`app.bsky.feed.post/<document TID>`).
- **Merge Bluesky responses in `app/writings/[slug]/page.tsx` only.** Never
  merge them in `lib/indieweb/webmention-storage.ts`, the activity feeds, or
  `/webmentions`.
- **Respect the owner's moderation.** Drop replies listed in the thread gate's
  `hiddenReplies`, and posts or authors labelled `!hide`, `!warn`, `porn`,
  `sexual`, `nudity`, `graphic-media` or `gore`.
- **PR C** contains Tasks 8 to 10, and **PR D** contains Tasks 11 and 12.

---

## PR C: Post to Bluesky from the sync

### Task 8: Read the Bluesky intent and copies from content

**Files:**

- Modify: `lib/writings/index.ts` (`RawFrontmatter` at about line 68, and the `writing` object at about line 246), `lib/writings/types.ts` (`WritingData`)
- Modify: `lib/indieweb/syndication.ts` (add `blueskyAccount`), `lib/atproto/config.ts` (add `blueskyAppview`), `.env.example`, `docs/indieweb/README.md` (an Environment variables row)
- Create: `lib/atproto/bluesky.ts` (URL helpers)
- Modify: `lib/atproto/records.ts` (`DocumentSource` gains three optional fields; export `clipGraphemes`)
- Modify: `lib/atproto/sync.ts` (extract `documentSource`)
- Test: `tests/unit/atproto-bluesky.test.mts`

**Interfaces:**

- Produces:
  - `parseSyndicateTo(value: unknown): string[] | undefined`, from `lib/writings`
  - `WritingData.syndicateTo?: string[]`
  - `blueskyAccount(): (typeof site.syndication)[number] | undefined`
  - `blueskyAppview(): string | undefined`, from `BLUESKY_APPVIEW_URL`
  - `parseBlueskyPostUrl(url: string): { actor: string; rkey: string } | null`
  - `blueskyPostUrl(uri: string): string`
  - `blueskyProfileUrl(did: string): string`
  - `DocumentSource` gains `hasExplicitTitle?: boolean`, `announce?: boolean` and `blueskyCopy?: string`
  - `clipGraphemes(text: string, max: number): string`, renamed from the private `clip`
  - `documentSource(writing: WritingData, body: string): DocumentSource`

- [ ] **Step 1: Write the failing test.** Create `tests/unit/atproto-bluesky.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  blueskyPostUrl,
  blueskyProfileUrl,
  parseBlueskyPostUrl,
} from '@/lib/atproto/bluesky';
import { documentSource } from '@/lib/atproto/sync';
import { blueskyAccount } from '@/lib/indieweb/syndication';
import { site } from '@/lib/site';
import { parseSyndicateTo } from '@/lib/writings';
import type { WritingData } from '@/lib/writings/types';

// The fixture identity and account from tests/unit/test.env.
const did = site.author.atprotoDid!;
const web = blueskyAccount()!.serviceUrl;

test('Bluesky post URLs and AT-URIs convert both ways', () => {
  const uri = `at://${did}/app.bsky.feed.post/3mwa5ei54c22g`;
  const url = blueskyPostUrl(uri);
  assert.equal(url, `${web}profile/${did}/post/3mwa5ei54c22g`);
  assert.deepEqual(parseBlueskyPostUrl(url), {
    actor: did,
    rkey: '3mwa5ei54c22g',
  });
  assert.deepEqual(
    parseBlueskyPostUrl(`${web}profile/alice.example/post/3abc?ref=x`),
    { actor: 'alice.example', rkey: '3abc' }
  );
  assert.equal(parseBlueskyPostUrl(`${web}profile/alice.example`), null);
  assert.equal(
    parseBlueskyPostUrl('https://elsewhere.example/profile/a/post/3abc'),
    null
  );
  assert.equal(blueskyProfileUrl(did), `${web}profile/${did}`);
});

test('syndicateTo keeps only uid strings', () => {
  assert.deepEqual(parseSyndicateTo(['a', 3, '', 'b']), ['a', 'b']);
  assert.equal(parseSyndicateTo('a'), undefined);
  assert.equal(parseSyndicateTo([]), undefined);
});

const base = {
  slug: 'a-note',
  title: 'A note about the site.',
  hasExplicitTitle: false,
  description: 'A note about the site.',
  published: new Date('2026-10-01T12:00:00Z'),
  lastUpdated: new Date('2026-10-01T12:00:00Z'),
  tags: [],
} as unknown as WritingData;

test('a writing that asks for Bluesky is marked to announce', () => {
  const source = documentSource(
    { ...base, syndicateTo: [blueskyAccount()!.profile] },
    'A note about the site.'
  );
  assert.equal(source.announce, true);
  assert.equal(source.hasExplicitTitle, false);
  assert.equal(source.blueskyCopy, undefined);
});

test('a hand-posted copy in syndication is picked up', () => {
  const copy = `${web}profile/${did}/post/3abc`;
  const source = documentSource(
    {
      ...base,
      syndication: [
        { name: 'Elsewhere', url: 'https://elsewhere.example/post/x' },
        { name: 'Bluesky', url: copy },
      ],
    },
    'Body'
  );
  assert.equal(source.announce, false);
  assert.equal(source.blueskyCopy, copy);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-bluesky.test.mts`
Expected: FAIL with `Cannot find module '@/lib/atproto/bluesky'`.

- [ ] **Step 3: Implement.**

**`lib/writings/types.ts`.** Add to `WritingData`, after `syndication`:

```ts
  /**
   * Syndication target uids the post asked for (Micropub's mp-syndicate-to).
   * Never rendered; the AT Protocol sync posts to Bluesky when it names
   * the Bluesky account.
   */
  syndicateTo?: string[];
```

**`lib/writings/index.ts`.**

- Add `syndicateTo?: unknown;` to `RawFrontmatter`, after `syndication`.
- Add `syndicateTo: parseSyndicateTo(frontmatter.syndicateTo),` to the `writing` object, after `syndication`.
- Add and export this function next to `parsePhotos`:

```ts
/** `syndicateTo` frontmatter as a list of target uids, or nothing. */
export function parseSyndicateTo(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const uids = value.filter(
    (uid): uid is string => typeof uid === 'string' && uid.length > 0
  );
  return uids.length > 0 ? uids : undefined;
}
```

**`lib/indieweb/syndication.ts`.** Append:

```ts
/** The Bluesky account in `site.syndication`, when one is configured. */
export function blueskyAccount():
  | (typeof site.syndication)[number]
  | undefined {
  return site.syndication.find((candidate) => candidate.service === 'Bluesky');
}
```

**`lib/atproto/config.ts`.** Append:

```ts
/**
 * The Bluesky AppView API the site reads public posts and threads from.
 * Empty turns off resolving hand-posted copies and showing responses.
 */
export function blueskyAppview(): string | undefined {
  return process.env.BLUESKY_APPVIEW_URL || undefined;
}
```

**`.env.example`.** Append this to the `# --- AT Protocol ---` section:

```bash
# The Bluesky AppView API for public reads (Bluesky documents
# https://public.api.bsky.app). Writing pages read their Bluesky replies and
# reactions from it, and the sync resolves hand-posted copies through it.
# Empty turns both off.
BLUESKY_APPVIEW_URL=
```

**`docs/indieweb/README.md`.** Add an Environment variables row: `` `BLUESKY_APPVIEW_URL` `` | `Bluesky responses on writings; resolving hand-posted copies` | `unset, both off`.

**`tests/unit/test.env`.** Append `BLUESKY_APPVIEW_URL=https://appview.example`, a fixture that is never contacted, because tests stub `fetch` or inject resolvers.

**`lib/atproto/bluesky.ts`.** Create it:

```ts
import { blueskyAccount } from '@/lib/indieweb/syndication';

/** The configured Bluesky web app's address, e.g. for post links. */
function web(): URL {
  const account = blueskyAccount();
  if (!account) throw new Error('No Bluesky account is configured.');
  return new URL(account.serviceUrl);
}

/**
 * The actor (DID or handle) and record key in a post URL on the configured
 * Bluesky web app; null for anything else, or when none is configured.
 */
export function parseBlueskyPostUrl(
  url: string
): { actor: string; rkey: string } | null {
  const account = blueskyAccount();
  if (!account || !URL.canParse(url)) return null;
  const parsed = new URL(url);
  if (parsed.host !== new URL(account.serviceUrl).host) return null;
  const match = /^\/profile\/([^/]+)\/post\/([^/]+)$/.exec(parsed.pathname);
  return match ? { actor: decodeURIComponent(match[1]), rkey: match[2] } : null;
}

/** `at://did/app.bsky.feed.post/rkey` as its web page, named by DID. */
export function blueskyPostUrl(uri: string): string {
  const [did, , rkey] = uri.slice('at://'.length).split('/');
  return new URL(`profile/${did}/post/${rkey}`, web()).href;
}

export function blueskyProfileUrl(did: string): string {
  return new URL(`profile/${did}`, web()).href;
}
```

**`lib/atproto/records.ts`.**

- Rename `clip` to `clipGraphemes` and export it. Update its two call sites.
- Add these to `DocumentSource`:

```ts
  /** False for a note, whose title is its first sentence. */
  hasExplicitTitle?: boolean;
  /** The writing asked to be announced on Bluesky (`syndicateTo`). */
  announce?: boolean;
  /** A Bluesky copy listed in `syndication`, posted by hand. */
  blueskyCopy?: string;
```

**`lib/atproto/sync.ts`.** Add the function below. Then change the loop in `publishedWritings` to `sources.push(documentSource(writing, content));`, and import `blueskyAccount`, `parseBlueskyPostUrl` and `type WritingData`:

```ts
/** A loaded writing as the sync sees it. */
export function documentSource(
  writing: WritingData,
  body: string
): DocumentSource {
  const bluesky = blueskyAccount();
  return {
    slug: writing.slug,
    title: writing.title,
    description: writing.description,
    published: writing.published,
    lastUpdated: writing.lastUpdated,
    tags: writing.tags,
    body,
    image: writing.featuredImage,
    hasExplicitTitle: writing.hasExplicitTitle,
    announce: Boolean(
      bluesky && writing.syndicateTo?.includes(bluesky.profile)
    ),
    blueskyCopy: writing.syndication?.find((link) =>
      parseBlueskyPostUrl(link.url)
    )?.url,
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-bluesky.test.mts tests/unit/atproto-records.test.mts tests/unit/atproto-sync.test.mts && pnpm typecheck`
Expected: PASS, with no type errors.

- [ ] **Step 5: Commit.** Paths: `lib/writings/index.ts lib/writings/types.ts lib/indieweb/syndication.ts lib/atproto/config.ts lib/atproto/bluesky.ts lib/atproto/records.ts lib/atproto/sync.ts .env.example docs/indieweb/README.md tests/unit/test.env tests/unit/atproto-bluesky.test.mts`. Message: `feat(atproto): Read Bluesky intent and hand-posted copies from writings`.

### Task 9: The announcement post

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml` (`pnpm add @atcute/bluesky@^4.0.22`)
- Modify: `lib/atproto/config.ts` (add `POST_COLLECTION`)
- Modify: `lib/atproto/bluesky.ts` (add `announcePost`)
- Test: `tests/unit/atproto-bluesky.test.mts`

**Interfaces:**

- Consumes: `DocumentSource`, `documentPath` and `clipGraphemes` (`lib/atproto/records.ts`); `stripMdxSyntax`.
- Produces:
  - `POST_COLLECTION`, which is `'app.bsky.feed.post'`
  - `interface StrongRef { uri: string; cid: string }`
  - `announcePost(source: DocumentSource, refs: { document: StrongRef; publication: StrongRef }, thumb: Blob | undefined, createdAt: Date): AppBskyFeedPost.Main`

- [ ] **Step 1: Write the failing test.** Append to `tests/unit/atproto-bluesky.test.mts`, moving the imports to the top:

```ts
import { AppBskyFeedPost } from '@atcute/bluesky';
import { safeParse } from '@atcute/lexicons';

import { announcePost } from '@/lib/atproto/bluesky';
import { publishingIdentity } from '@/lib/atproto/config';
import type { DocumentSource } from '@/lib/atproto/records';

const refs = {
  document: {
    uri: `at://${did}/site.standard.document/3mwa5ei54c22g`,
    cid: 'bafyreidoc',
  },
  publication: { uri: publishingIdentity().publicationUri, cid: 'bafyreipub' },
};
const at = new Date('2026-10-02T12:00:00Z');
const article: DocumentSource = {
  slug: 'fall-tour-2026-begins',
  title: 'Fall Tour 2026 begins',
  description: 'Where I am going and why.',
  published: new Date('2026-09-23T18:51:00-07:00'),
  lastUpdated: new Date('2026-09-23T18:51:00-07:00'),
  tags: [],
  body: 'Long body.',
  hasExplicitTitle: true,
};
const external = (post: ReturnType<typeof announcePost>) =>
  post.embed?.$type === 'app.bsky.embed.external'
    ? post.embed.external
    : undefined;

test('an article is announced by its title with a card back to the site', () => {
  const post = announcePost(article, refs, undefined, at);
  const result = safeParse(AppBskyFeedPost.mainSchema, post);
  assert.ok(result.ok, result.ok ? '' : result.message);
  assert.equal(post.text, 'Fall Tour 2026 begins');
  assert.equal(post.createdAt, '2026-10-02T12:00:00.000Z');
  assert.deepEqual(post.langs, [site.language]);
  assert.equal(
    external(post)?.uri,
    `${site.origin}/writings/fall-tour-2026-begins`
  );
  assert.equal(external(post)?.description, 'Where I am going and why.');
  assert.deepEqual(external(post)?.associatedRefs, [
    refs.document,
    refs.publication,
  ]);
});

test('a note is announced in its own words, clipped to 300 graphemes', () => {
  const note = {
    ...article,
    title: 'A note.',
    description: 'A note.',
    hasExplicitTitle: false,
    body: `**Bold** ${'word '.repeat(100)}`,
  };
  const post = announcePost(note, refs, undefined, at);
  assert.ok(post.text.startsWith('Bold word'));
  assert.equal([...new Intl.Segmenter().segment(post.text)].length, 300);
  assert.equal(
    external(post)?.description,
    '',
    'no description that repeats the title'
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm add @atcute/bluesky@^4.0.22 && pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-bluesky.test.mts`
Expected: FAIL with `announcePost` not exported.

- [ ] **Step 3: Implement.** In `lib/atproto/config.ts`, add:

```ts
export const POST_COLLECTION = 'app.bsky.feed.post';
```

Add to `lib/atproto/bluesky.ts`, with these imports at the top of the file:

```ts
import type { AppBskyFeedPost } from '@atcute/bluesky';
import type { Blob } from '@atcute/lexicons';

import { absoluteUrl, site } from '@/lib/site';
import { stripMdxSyntax } from '@/lib/text/strip-mdx';

import { type DocumentSource, clipGraphemes, documentPath } from './records';

export interface StrongRef {
  uri: string;
  cid: string;
}

/**
 * The Bluesky post that announces a writing: an article by its title, a
 * note in its own words, each with a link card back to the writing. The
 * card's associatedRefs name the standard.site records, which is how
 * Bluesky draws the publication on the card.
 */
export function announcePost(
  source: DocumentSource,
  refs: { document: StrongRef; publication: StrongRef },
  thumb: Blob | undefined,
  createdAt: Date
): AppBskyFeedPost.Main {
  const text =
    source.hasExplicitTitle === false
      ? stripMdxSyntax(source.body)
      : source.title;
  return {
    $type: 'app.bsky.feed.post',
    text: clipGraphemes(text, 300),
    createdAt: createdAt.toISOString(),
    langs: [site.language],
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: absoluteUrl(documentPath(source.slug)) as `${string}:${string}`,
        title: source.title,
        description:
          source.description === source.title ? '' : source.description,
        ...(thumb && { thumb }),
        associatedRefs: [refs.document, refs.publication] as never,
      },
    },
  };
}
```

The `as never` on `associatedRefs` exists only because atcute brands `uri` as `ResourceUri` and `cid` as `Cid`. If `pnpm typecheck` accepts plain strings there, drop the cast.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-bluesky.test.mts && pnpm typecheck`
Expected: PASS, with no type errors.

- [ ] **Step 5: Commit.** Paths: `package.json pnpm-lock.yaml lib/atproto/config.ts lib/atproto/bluesky.ts tests/unit/atproto-bluesky.test.mts`. Message: `feat(atproto): Build the Bluesky post that announces a writing`.

### Task 10: Announce opted-in writings in the sync

**Files:**

- Modify: `lib/atproto/types.ts` (`DesiredRecord.source`, `WriteResult`, `RepoClient` gains `getRecord`, `createRecord` and `putRecord`; `applyWrites` returns results)
- Modify: `lib/atproto/plan.ts` (`SyncPlan.final`; export `key`)
- Modify: `lib/atproto/client.ts`, `lib/atproto/sync.ts`
- Modify: `app/api/indieweb/notify/route.ts` (revalidate the `atproto` tag)
- Modify: `docs/atproto.md`, `docs/indieweb/README.md` (Syndication section)
- Test: `tests/unit/atproto-plan.test.mts`, `tests/unit/atproto-sync.test.mts`

**Interfaces:**

- Consumes: `announcePost`, `StrongRef`, `blueskyPostUrl` and `parseBlueskyPostUrl` (Tasks 8 and 9).
- Produces:
  - `SyncPlan.final: Map<string, Record<string, unknown>>`, keyed by `${collection}/${rkey}`. It holds every desired record's value after carry-over.
  - `RepoClient.applyWrites(writes): Promise<WriteResult[]>`, one result per create or update, in order.
  - `RepoClient.getRecord(collection, rkey): Promise<{ cid: string; value: Record<string, unknown> } | null>`
  - `RepoClient.createRecord(collection, rkey, value): Promise<{ cid: string }>`
  - `RepoClient.putRecord(collection, rkey, value, swapRecord: string): Promise<{ cid: string }>`
  - `SyncOptions.resolveCopy?: (url: string) => Promise<StrongRef | null>` and `SyncOptions.now?: Date`
  - `SyncReport` (non-skipped) gains `announced: { document: string; post: string | null }[]`. `post` is `null` in a dry run.

- [ ] **Step 1: Write the failing planner test.** Append to `tests/unit/atproto-plan.test.mts`:

```ts
test('the plan reports every record’s final value, post reference included', () => {
  const want = doc('3mwa5ei54c22g', '/writings/a');
  const have = stored(want);
  have.value.bskyPostRef = ref;
  const plan = planSync([publication(), want], [have]);
  assert.deepEqual(
    plan.final.get(`${DOCUMENT_COLLECTION}/3mwa5ei54c22g`)?.bskyPostRef,
    ref
  );
  assert.ok(plan.final.has(`${PUBLICATION_COLLECTION}/${PUBLICATION_RKEY}`));
});
```

- [ ] **Step 2: Update the sync test's fake and add the announcement tests.** In `tests/unit/atproto-sync.test.mts`, replace `fakeRepo` with the version below. It assigns fake CIDs and implements the new methods:

```ts
function fakeRepo() {
  const records: {
    collection: string;
    rkey: string;
    cid: string;
    value: Record<string, unknown>;
  }[] = [];
  const log = { writes: [] as Write[], uploads: [] as LocalBlob[], posts: 0 };
  let version = 0;
  const find = (collection: string, rkey: string) =>
    records.findIndex((r) => r.collection === collection && r.rkey === rkey);
  const upsert = (collection: string, rkey: string, value: object) => {
    const at = find(collection, rkey);
    if (at >= 0) records.splice(at, 1);
    const cid = `bafyrei-${++version}`;
    records.push({
      collection,
      rkey,
      cid,
      value: JSON.parse(JSON.stringify(value)),
    });
    return cid;
  };
  const client: RepoClient = {
    async listRecords(collection) {
      return records.filter(
        (record) => record.collection === collection
      ) as ExistingRecord[];
    },
    async applyWrites(writes) {
      log.writes.push(...writes);
      const results = [];
      for (const write of writes) {
        if (write.$type === 'com.atproto.repo.applyWrites#delete') {
          records.splice(find(write.collection, write.rkey), 1);
        } else {
          results.push({
            collection: write.collection,
            rkey: write.rkey,
            cid: upsert(write.collection, write.rkey, write.value),
          });
        }
      }
      return results;
    },
    async uploadBlob(blob) {
      log.uploads.push(blob);
    },
    async getRecord(collection, rkey) {
      const found = records[find(collection, rkey)];
      return found ? { cid: found.cid, value: found.value } : null;
    },
    async createRecord(collection, rkey, value) {
      if (find(collection, rkey) >= 0) throw new Error('exists');
      if (collection === 'app.bsky.feed.post') log.posts += 1;
      return { cid: upsert(collection, rkey, value) };
    },
    async putRecord(collection, rkey, value, swapRecord) {
      assert.equal(
        records[find(collection, rkey)]?.cid,
        swapRecord,
        'swapRecord is the current version'
      );
      return { cid: upsert(collection, rkey, value) };
    },
    async close() {},
  };
  return { client, records, log };
}
```

Then append these tests:

```ts
const optedIn: DocumentSource = {
  ...note,
  announce: true,
  hasExplicitTitle: false,
};
const now = new Date('2026-10-02T12:00:00Z');

test('an opted-in writing is announced once and its document points at the post', async () => {
  const { client, records, log } = fakeRepo();
  const first = await syncAtproto({
    client,
    writings: [optedIn],
    fetchImage: png,
    now,
  });
  assert.equal(log.posts, 1);
  const post = records.find((r) => r.collection === 'app.bsky.feed.post');
  const document = records.find((r) => r.collection === DOCUMENT_COLLECTION);
  assert.ok(post && document);
  assert.equal(post.rkey, document.rkey, 'the post shares the document’s key');
  assert.deepEqual(document.value.bskyPostRef, {
    uri: `at://${site.author.atprotoDid}/app.bsky.feed.post/${post.rkey}`,
    cid: post.cid,
  });
  assert.equal(first.status !== 'skipped' && first.announced.length, 1);

  const second = await syncAtproto({
    client,
    writings: [optedIn],
    fetchImage: png,
    now,
  });
  assert.equal(log.posts, 1, 'never posted twice');
  assert.equal(second.status !== 'skipped' && second.unchanged, 2);
});

test('a post left by a failed run is reused, not posted again', async () => {
  const { client, records, log } = fakeRepo();
  await syncAtproto({ client, writings: [note], fetchImage: png, now });
  const rkey = records.find((r) => r.collection === DOCUMENT_COLLECTION)!.rkey;
  await client.createRecord('app.bsky.feed.post', rkey, { text: 'earlier' });
  log.posts = 0;
  await syncAtproto({ client, writings: [optedIn], fetchImage: png, now });
  assert.equal(log.posts, 0);
  assert.ok(
    records.find((r) => r.collection === DOCUMENT_COLLECTION)!.value.bskyPostRef
  );
});

test('a hand-posted copy becomes the reference and nothing is posted', async () => {
  const { client, records, log } = fakeRepo();
  const copy = {
    uri: 'at://did:plc:x/app.bsky.feed.post/3abc',
    cid: 'bafyrei-copy',
  };
  await syncAtproto({
    client,
    writings: [
      {
        ...optedIn,
        blueskyCopy: 'https://social.example/profile/did:plc:x/post/3abc',
      },
    ],
    fetchImage: png,
    resolveCopy: async () => copy,
    now,
  });
  assert.equal(log.posts, 0);
  assert.deepEqual(
    records.find((r) => r.collection === DOCUMENT_COLLECTION)?.value
      .bskyPostRef,
    copy
  );
});

test('writings that did not opt in are never announced, and dry runs never post', async () => {
  const { client, log } = fakeRepo();
  await syncAtproto({ client, writings: [note], fetchImage: png, now });
  assert.equal(log.posts, 0);
  const dry = await syncAtproto({
    client,
    dryRun: true,
    writings: [optedIn],
    fetchImage: png,
    now,
  });
  assert.equal(log.posts, 0);
  assert.deepEqual(dry.status !== 'skipped' && dry.announced, [
    { document: '/writings/a-note', post: null },
  ]);
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-plan.test.mts tests/unit/atproto-sync.test.mts`
Expected: FAIL. `plan.final` is undefined, and `getRecord` is not a function.

- [ ] **Step 4: Implement the types and the planner.**

**`lib/atproto/types.ts`.**

- Import `type DocumentSource` from `./records`, and `type POST_COLLECTION` (with `type Collection`) from `./config`.
- Add `source?: DocumentSource;` to `DesiredRecord`, with the doc comment `/** The writing a document comes from; absent on the publication. */`.
- Add `WriteResult`, and replace `RepoClient`:

```ts
export interface WriteResult {
  collection: Collection;
  rkey: string;
  cid: string;
}

type AnyCollection = Collection | typeof POST_COLLECTION;

/** The few repo calls the sync makes; tests pass a fake. */
export interface RepoClient {
  listRecords(collection: Collection): Promise<ExistingRecord[]>;
  /** One result per create or update, in the order written. */
  applyWrites(writes: Write[]): Promise<WriteResult[]>;
  uploadBlob(blob: LocalBlob): Promise<void>;
  getRecord(
    collection: AnyCollection,
    rkey: string
  ): Promise<{ cid: string; value: Record<string, unknown> } | null>;
  /** Fails if the record exists. */
  createRecord(
    collection: AnyCollection,
    rkey: string,
    value: object
  ): Promise<{ cid: string }>;
  /** Fails unless the current version is `swapRecord`. */
  putRecord(
    collection: AnyCollection,
    rkey: string,
    value: object,
    swapRecord: string
  ): Promise<{ cid: string }>;
  close(): Promise<void>;
}
```

**`lib/atproto/plan.ts`.**

- Add `final: Map<string, Record<string, unknown>>;` to `SyncPlan`, documented as `/** Every desired record's value after carry-over, by "collection/rkey". */`.
- Create `const final = new Map<string, Record<string, unknown>>();` before the loop.
- Call `final.set(key(want), value);` right after the `bskyPostRef` carry-over, before the `if (current)` check.
- Return `{ writes, uploads: [...uploads.values()], unchanged, final }`.
- Export `key`, so the sync builds the same keys.

- [ ] **Step 5: Implement the client methods.** In `lib/atproto/client.ts`, replace `applyWrites`, and add the three methods:

```ts
    async applyWrites(writes) {
      const results: WriteResult[] = [];
      for (let start = 0; start < writes.length; start += MAX_WRITES) {
        const chunk = writes.slice(start, start + MAX_WRITES);
        const output = await ok(
          rpc.post('com.atproto.repo.applyWrites', {
            input: { repo: did, writes: chunk },
          })
        );
        chunk.forEach((write, index) => {
          const result = output.results?.[index];
          if (result && 'cid' in result) {
            results.push({
              collection: write.collection,
              rkey: write.rkey,
              cid: result.cid,
            });
          }
        });
      }
      return results;
    },
    async getRecord(collection, rkey) {
      const response = await rpc.get('com.atproto.repo.getRecord', {
        params: { repo: did, collection, rkey },
      });
      if (response.ok) {
        return {
          cid: response.data.cid ?? '',
          value: response.data.value as Record<string, unknown>,
        };
      }
      if (response.data.error === 'RecordNotFound') return null;
      throw new Error(
        `getRecord ${collection}/${rkey} failed: ${response.data.error}`
      );
    },
    async createRecord(collection, rkey, value) {
      const { cid } = await ok(
        rpc.post('com.atproto.repo.createRecord', {
          input: { repo: did, collection, rkey, record: value as never },
        })
      );
      return { cid };
    },
    async putRecord(collection, rkey, value, swapRecord) {
      const { cid } = await ok(
        rpc.post('com.atproto.repo.putRecord', {
          input: {
            repo: did,
            collection,
            rkey,
            record: value as never,
            swapRecord,
          },
        })
      );
      return { cid };
    },
```

Import `type WriteResult` from `./types`.

- [ ] **Step 6: Implement the announcement step.** In `lib/atproto/sync.ts`, make these changes:
- Import `POST_COLLECTION` and `blueskyAppview` from `./config`, `key` from `./plan`, `announcePost`, `blueskyPostUrl`, `parseBlueskyPostUrl` and `type StrongRef`.
- Extend `SyncOptions`:

```ts
  /** Resolves a bsky.app post URL to a strong reference; tests pass a stub. */
  resolveCopy?: (url: string) => Promise<StrongRef | null>;
  /** The time an announcement is stamped with; tests pass a fixed one. */
  now?: Date;
```

- Add `announced: { document: string; post: string | null }[];` to the non-skipped `SyncReport` variant.
- Add this resolver:

```ts
/**
 * A Bluesky post URL as {uri, cid}, through the configured AppView. Null
 * when the URL is not a post or no AppView is configured; the writing is
 * then left unannounced rather than risk a second post.
 */
async function resolveCopy(url: string): Promise<StrongRef | null> {
  const parsed = parseBlueskyPostUrl(url);
  const service = blueskyAppview();
  if (!parsed || !service) return null;
  const { Client, ok, simpleFetchHandler } = await import('@atcute/client');
  const rpc = new Client({ handler: simpleFetchHandler({ service }) });
  let did = parsed.actor;
  if (!did.startsWith('did:')) {
    ({ did } = await ok(
      rpc.get('com.atproto.identity.resolveHandle', {
        params: { handle: did as `${string}.${string}` },
      })
    ));
  }
  const uri = `at://${did}/${POST_COLLECTION}/${parsed.rkey}`;
  const { posts } = await ok(
    rpc.get('app.bsky.feed.getPosts', { params: { uris: [uri as never] } })
  );
  return posts[0] ? { uri: posts[0].uri, cid: posts[0].cid } : null;
}
```

- In `desiredRecords`, give it a `resolve` parameter (`(url: string) => Promise<StrongRef | null>`). Inside the loop, resolve the hand-posted copy and keep the source on the record:

```ts
const bskyPostRef = writing.blueskyCopy
  ? ((await resolve(writing.blueskyCopy)) ?? undefined)
  : undefined;
records.push({
  collection: DOCUMENT_COLLECTION,
  rkey: documentRkey(path, writing.published),
  value: documentRecord(writing, { coverImage: cover?.ref, bskyPostRef }),
  blobs: cover ? [cover] : [],
  source: writing,
});
```

- Pass `options.resolveCopy ?? resolveCopy` from `syncAtproto`.
- Add the selector and the announcing step:

```ts
type Announceable = DesiredRecord & { source: DocumentSource };

/**
 * Documents to announce: opted in, and no Bluesky copy known yet. A copy
 * listed in `syndication` counts even when it could not be resolved.
 */
function pendingAnnouncements(
  desired: DesiredRecord[],
  final: Map<string, Record<string, unknown>>
): Announceable[] {
  return desired.filter(
    (record): record is Announceable =>
      !!record.source?.announce &&
      !record.source.blueskyCopy &&
      !final.get(key(record))?.bskyPostRef
  );
}

/**
 * Post each pending announcement, then point its document at the post.
 * The post takes the document's record key, so a run that dies between
 * the two writes finds its post next time instead of posting again.
 */
async function announce(
  client: RepoClient,
  pending: Announceable[],
  final: Map<string, Record<string, unknown>>,
  cids: Map<string, string>,
  now: Date
): Promise<{ document: string; post: string }[]> {
  const { did, publicationRkey, publicationUri } = publishingIdentity();
  const publication: StrongRef = {
    uri: publicationUri,
    cid: cids.get(`${PUBLICATION_COLLECTION}/${publicationRkey}`) ?? '',
  };
  const announced = [];
  for (const record of pending) {
    const document: StrongRef = {
      uri: `at://${did}/${DOCUMENT_COLLECTION}/${record.rkey}`,
      cid: cids.get(key(record)) ?? '',
    };
    const post =
      (await client.getRecord(POST_COLLECTION, record.rkey)) ??
      (await client.createRecord(
        POST_COLLECTION,
        record.rkey,
        announcePost(
          record.source,
          { document, publication },
          record.blobs[0]?.ref,
          now
        )
      ));
    const bskyPostRef = {
      uri: `at://${did}/${POST_COLLECTION}/${record.rkey}`,
      cid: post.cid,
    };
    await client.putRecord(
      DOCUMENT_COLLECTION,
      record.rkey,
      { ...final.get(key(record)), bskyPostRef },
      document.cid
    );
    announced.push({
      document: documentPath(record.source.slug),
      post: blueskyPostUrl(bskyPostRef.uri),
    });
  }
  return announced;
}
```

- In `syncAtproto`, after the plan, replace the write block. `existing` is the listed records from before:

```ts
const pending = pendingAnnouncements(desired, plan.final);
let announced: { document: string; post: string | null }[] = pending.map(
  (record) => ({ document: documentPath(record.source.slug), post: null })
);
if (!options.dryRun) {
  for (const blob of plan.uploads) await client.uploadBlob(blob);
  const results =
    plan.writes.length > 0 ? await client.applyWrites(plan.writes) : [];
  const cids = new Map(existing.map((record) => [key(record), record.cid]));
  for (const result of results) cids.set(key(result), result.cid);
  announced = await announce(
    client,
    pending,
    plan.final,
    cids,
    options.now ?? new Date()
  );
}
```

- Add `announced` to the returned report.

- [ ] **Step 7: Revalidate pages after a sync that changed something.** In `app/api/indieweb/notify/route.ts`, import `revalidateTag` from `next/cache`. After `const atproto = …`, add:

```ts
// Pages read their Bluesky copy from the document record (tag atproto).
if (
  atproto.status === 'synced' &&
  (atproto.writes.length > 0 || atproto.announced.length > 0)
) {
  revalidateTag('atproto', 'max');
}
```

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-plan.test.mts tests/unit/atproto-sync.test.mts tests/unit/indieweb-notify.test.mts && pnpm typecheck`
Expected: PASS, with no type errors.

- [ ] **Step 9: Update the docs.**

In the Syndication section of `docs/indieweb/README.md`, replace the paragraph that starts "The site has no API access to either service" with:

```markdown
Bluesky is automated through the AT Protocol sync (see
[atproto.md](../atproto.md)). After a writing whose `syndicateTo` names the
Bluesky account is deployed, the sync posts one announcement: a link card
back to the writing, carrying its standard.site records. It then records the
post on the writing's document as `bskyPostRef`. The page reads that
reference and shows the copy as `u-syndication`. Nothing is written back to
the frontmatter, because `main` only takes changes through pull requests. A
copy posted by hand still goes in `syndication`, and then nothing is posted.

Threads stays manual POSSE. Choosing it records intent in `syndicateTo`.
After the post deploys, Willie posts the copy from his account (the
writing's **Share on Threads** link opens an editable draft with the
canonical URL), confirms the copy links back, and adds its exact permalink
to `syndication`. `syndicateTo` never renders.
```

Append to `docs/atproto.md`:

```markdown
## Bluesky

- **Opting in:** add the Bluesky profile uid to `syndicateTo`. Micropub's
  `mp-syndicate-to` writes it. The next production sync then posts one
  announcement: an article posts its title, and a note posts its own words
  (up to 300 graphemes), each with a link card back to the writing.
- **The post's record key is the document's.** A sync that fails midway
  finds its earlier post and does not post twice.
- **Never re-posted.** Edits never post again, and code never edits or
  deletes a post. Unpublishing a writing removes its document record, but
  the post stays on Bluesky.
- **Posted by hand:** list the copy's bsky.app URL in `syndication`. It
  becomes the document's `bskyPostRef`, and nothing is posted.
```

- [ ] **Step 10: Commit and open PR C.** Paths: `lib/atproto/types.ts lib/atproto/plan.ts lib/atproto/client.ts lib/atproto/sync.ts app/api/indieweb/notify/route.ts docs/atproto.md docs/indieweb/README.md tests/unit/atproto-plan.test.mts tests/unit/atproto-sync.test.mts`. Message: `feat(atproto): Announce opted-in writings on Bluesky`. The PR title is `feat(atproto): Post writings to Bluesky from the sync` (Tasks 8 to 10).

---

## PR D: Bluesky responses on the site

### Task 11: The Bluesky copy on the page

**Files:**

- Create: `lib/atproto/read.ts`
- Modify: `lib/atproto/bluesky.ts` (add `withBlueskyCopy`)
- Modify: `app/writings/[slug]/page.tsx`, `components/writings/PostInteractions.tsx`, `components/writings/PostActions.tsx`
- Test: `tests/unit/atproto-read.test.mts`

**Interfaces:**

- Consumes: `resolvePds` (standard.site plan, Task 7), `ATPROTO_DID`, `documentRkey`, `blueskyPostUrl`.
- Produces:
  - `interface BlueskyCopy { uri: string; url: string }`
  - `readBlueskyCopy(path: string, published: Date): Promise<BlueskyCopy | null>`
  - `withBlueskyCopy(links: SyndicationLink[] | undefined, copy: BlueskyCopy | null): SyndicationLink[] | undefined`
  - `PostActions` gains `blueskyReplyHref?: string`

- [ ] **Step 1: Write the failing test.** Create `tests/unit/atproto-read.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { blueskyPostUrl, withBlueskyCopy } from '@/lib/atproto/bluesky';
import { documentRkey } from '@/lib/atproto/keys';
import { readBlueskyCopy } from '@/lib/atproto/read';
import { blueskyAccount } from '@/lib/indieweb/syndication';
import { site } from '@/lib/site';

// The fixture identity and account from tests/unit/test.env.
const did = site.author.atprotoDid!;
const web = blueskyAccount()!.serviceUrl;
const pds = 'https://pds.example';
const published = new Date('2026-09-23T18:51:00-07:00');
const path = '/writings/fall-tour-2026-begins';
const postUri = `at://${did}/app.bsky.feed.post/3mwa5ei54c22g`;

/** Answers the DID document lookup, wherever the resolver sends it, and the PDS. */
function stubFetch(record: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === `/${encodeURIComponent(did)}`) {
      return Response.json({
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        service: [
          {
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: pds,
          },
        ],
      });
    }
    assert.equal(url.origin, pds);
    assert.equal(url.searchParams.get('rkey'), documentRkey(path, published));
    return record
      ? Response.json({ uri: 'at://x', cid: 'bafyrei', value: record })
      : Response.json(
          { error: 'RecordNotFound', message: 'gone' },
          { status: 400 }
        );
  }) as typeof fetch;
  return () => (globalThis.fetch = original);
}

test('a document with a post reference yields its Bluesky copy', async () => {
  const restore = stubFetch({
    bskyPostRef: { uri: postUri, cid: 'bafyreipost' },
  });
  try {
    assert.deepEqual(await readBlueskyCopy(path, published), {
      uri: postUri,
      url: blueskyPostUrl(postUri),
    });
  } finally {
    restore();
  }
});

test('no record, or no reference, means no copy', async () => {
  for (const record of [null, { title: 'x' }]) {
    const restore = stubFetch(record);
    try {
      assert.equal(await readBlueskyCopy(path, published), null);
    } finally {
      restore();
    }
  }
});

test('the copy joins syndication once', () => {
  const copy = { uri: postUri, url: blueskyPostUrl(postUri) };
  assert.deepEqual(withBlueskyCopy(undefined, copy), [
    { name: 'Bluesky', url: copy.url },
  ]);
  const handForm = [
    {
      name: 'Bluesky',
      url: `${web}profile/alice.example/post/3mwa5ei54c22g`,
    },
  ];
  assert.deepEqual(withBlueskyCopy(handForm, copy), handForm);
  assert.equal(withBlueskyCopy(undefined, null), undefined);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-read.test.mts`
Expected: FAIL with `Cannot find module '@/lib/atproto/read'`.

- [ ] **Step 3: Implement.** Create `lib/atproto/read.ts`:

```ts
import type {} from '@atcute/atproto';
import { Client, simpleFetchHandler } from '@atcute/client';

import { blueskyPostUrl } from './bluesky';
import { ATPROTO_DID, DOCUMENT_COLLECTION } from './config';
import { resolvePds } from './identity';
import { documentRkey } from './keys';

export interface BlueskyCopy {
  /** The post's AT-URI. */
  uri: string;
  /** Its page on the configured Bluesky web app. */
  url: string;
}

/**
 * The Bluesky post a writing was announced with, read from the
 * `bskyPostRef` on its standard.site document. Null when the writing has
 * no record yet or was never announced.
 */
export async function readBlueskyCopy(
  path: string,
  published: Date
): Promise<BlueskyCopy | null> {
  if (!ATPROTO_DID) return null;
  const rpc = new Client({
    handler: simpleFetchHandler({ service: await resolvePds(ATPROTO_DID) }),
  });
  const response = await rpc.get('com.atproto.repo.getRecord', {
    params: {
      repo: ATPROTO_DID,
      collection: DOCUMENT_COLLECTION,
      rkey: documentRkey(path, published),
    },
  });
  if (!response.ok) return null;
  const ref = (response.data.value as { bskyPostRef?: { uri?: unknown } })
    .bskyPostRef;
  return typeof ref?.uri === 'string'
    ? { uri: ref.uri, url: blueskyPostUrl(ref.uri) }
    : null;
}
```

Append to `lib/atproto/bluesky.ts`, importing `type BlueskyCopy` from `./read` and `type SyndicationLink` from `@/lib/writings/types`:

```ts
/**
 * Syndication links with the Bluesky copy added, unless a link to the
 * same post is already there (a hand-posted copy, perhaps by handle).
 */
export function withBlueskyCopy(
  links: SyndicationLink[] | undefined,
  copy: BlueskyCopy | null
): SyndicationLink[] | undefined {
  if (!copy) return links;
  const rkey = parseBlueskyPostUrl(copy.url)?.rkey;
  if (links?.some((link) => parseBlueskyPostUrl(link.url)?.rkey === rkey)) {
    return links;
  }
  return [...(links ?? []), { name: 'Bluesky', url: copy.url }];
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-read.test.mts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire it into the page.** In `app/writings/[slug]/page.tsx`, add a cached loader next to `loadWebmentions`:

```ts
/**
 * The Bluesky copy, from the writing's document record. Cached for hours
 * and tagged so the post-deploy sync can refresh it right after
 * announcing; a missing or unreachable PDS resolves to nothing.
 */
async function loadBlueskyCopy(
  path: string,
  publishedIso: string
): Promise<BlueskyCopy | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('atproto');
  try {
    return await readBlueskyCopy(path, new Date(publishedIso));
  } catch {
    return null;
  }
}
```

In `WritingDetailPage`, move `const path = …` above the `Promise.all`. Add `loadBlueskyCopy(path, writing.published.toISOString())` as a fifth entry in the `Promise.all`, destructured as `blueskyCopy`. Then:

- pass `writing={{ ...writing, syndication: withBlueskyCopy(writing.syndication, blueskyCopy) }}` to `<WritingHeader>`;
- pass `blueskyCopy={blueskyCopy}` to `<PostInteractions>`.

In `components/writings/PostInteractions.tsx`, add a `blueskyCopy: BlueskyCopy | null;` prop, and pass `blueskyReplyHref={blueskyCopy?.url}` to `<PostActions>`.

In `components/writings/PostActions.tsx`, add `blueskyReplyHref?: string;`. Show "Reply on Bluesky" in place of "Share on Bluesky" when it is set:

```tsx
<SiteLink
  href={blueskyReplyHref ?? blueskyHref}
  target="_blank"
  data-post-action
  className={secondaryAction}
>
  <BlueskyIcon className="size-4" />
  {blueskyReplyHref ? 'Reply on Bluesky' : 'Share on Bluesky'}
</SiteLink>
```

- [ ] **Step 6: Typecheck and check by eye**

Run: `pnpm typecheck && pnpm build`
Expected: both pass. `loadBlueskyCopy` swallows errors, so the build never depends on the PDS. Until a writing is announced, the page looks exactly as before.

- [ ] **Step 7: Commit.** Paths: `lib/atproto/read.ts lib/atproto/bluesky.ts "app/writings/[slug]/page.tsx" components/writings/PostInteractions.tsx components/writings/PostActions.tsx tests/unit/atproto-read.test.mts`. Message: `feat(atproto): Link each writing to its Bluesky copy`.

### Task 12: Bluesky replies, likes, reposts, and quotes as responses

**Files:**

- Create: `lib/atproto/responses.ts`
- Modify: `app/writings/[slug]/page.tsx`
- Modify: `docs/atproto.md`, `docs/indieweb/README.md` (the webmention display section, at about lines 103 to 150)
- Test: `tests/unit/atproto-responses.test.mts`

**Interfaces:**

- Consumes: `blueskyPostUrl`, `blueskyProfileUrl` (Task 8); `Webmention`, `WebmentionGroup` (`lib/indieweb/types.ts`).
- Produces:
  - `interface BlueskyActivity { thread: ThreadNode; hiddenReplies: string[]; likes: Like[]; reposts: Profile[]; quotes: PostView[] }`
  - `responsesFromBluesky(activity: BlueskyActivity, target: string): WebmentionGroup`
  - `getBlueskyResponses(postUri: string, target: string): Promise<WebmentionGroup | null>`, null without `BLUESKY_APPVIEW_URL`
  - `mergeResponses(...groups: (WebmentionGroup | null)[]): WebmentionGroup | null`

- [ ] **Step 1: Write the failing test.** Create `tests/unit/atproto-responses.test.mts`:

```ts
import { mf2 } from 'microformats-parser';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import WebmentionSection from '@/components/indieweb/WebmentionSection';

import { blueskyPostUrl, blueskyProfileUrl } from '@/lib/atproto/bluesky';
import {
  type BlueskyActivity,
  mergeResponses,
  responsesFromBluesky,
} from '@/lib/atproto/responses';
import type { WebmentionGroup } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

const target = `${site.origin}/writings/a-note`;
const alice = {
  did: 'did:plc:alice',
  handle: 'alice.example',
  displayName: 'Alice',
  avatar: 'https://avatars.example/a.jpg',
};
const bob = { did: 'did:plc:bob', handle: 'bob.example' };
const aliceReply = blueskyPostUrl('at://did:plc:alice/app.bsky.feed.post/3a');

function post(
  rkey: string,
  author: { did: string; handle: string },
  text: string,
  labels: { val: string }[] = []
) {
  return {
    uri: `at://${author.did}/app.bsky.feed.post/${rkey}`,
    indexedAt: '2026-10-02T13:00:00.000Z',
    author,
    record: { text, createdAt: '2026-10-02T12:30:00.000Z' },
    labels,
  };
}

const activity: BlueskyActivity = {
  thread: {
    $type: 'app.bsky.feed.defs#threadViewPost',
    post: post('3root', alice, 'Announcement'),
    replies: [
      {
        $type: 'app.bsky.feed.defs#threadViewPost',
        post: post('3a', alice, 'Great post!'),
      },
      {
        $type: 'app.bsky.feed.defs#threadViewPost',
        post: post('3b', bob, 'Hidden by Willie'),
      },
      {
        $type: 'app.bsky.feed.defs#threadViewPost',
        post: post('3c', bob, 'Spam', [{ val: '!hide' }]),
      },
      { $type: 'app.bsky.feed.defs#blockedPost' },
      { $type: 'app.bsky.feed.defs#notFoundPost' },
    ],
  },
  hiddenReplies: ['at://did:plc:bob/app.bsky.feed.post/3b'],
  likes: [
    {
      actor: bob,
      createdAt: '2026-10-02T12:40:00.000Z',
      indexedAt: '2026-10-02T12:40:01.000Z',
    },
  ],
  reposts: [alice],
  quotes: [post('3q', bob, 'Quoting this')],
};

test('visible replies become comments and moderated ones are dropped', () => {
  const group = responsesFromBluesky(activity, target);
  assert.deepEqual(
    group.replies.map((reply) => reply.content),
    ['Great post!']
  );
  const [reply] = group.replies;
  assert.equal(reply.sourceUrl, aliceReply);
  assert.equal(reply.targetUrl, target);
  assert.deepEqual(reply.author, {
    name: 'Alice',
    url: blueskyProfileUrl('did:plc:alice'),
    photo: 'https://avatars.example/a.jpg',
  });
  assert.equal(reply.publishedAt?.toISOString(), '2026-10-02T12:30:00.000Z');
});

test('likes, reposts, and quotes map to their webmention kinds', () => {
  const group = responsesFromBluesky(activity, target);
  assert.equal(
    group.likes[0].author.name,
    'bob.example',
    'handle when no display name'
  );
  assert.equal(group.likes[0].sourceUrl, blueskyProfileUrl('did:plc:bob'));
  assert.equal(group.reposts[0].type, 'repost');
  assert.equal(group.mentions[0].content, 'Quoting this');
});

test('Bluesky replies render as h-cite comments inside the post', () => {
  const html = renderToStaticMarkup(
    createElement(
      'article',
      { className: 'h-entry' },
      createElement(WebmentionSection, {
        webmentions: responsesFromBluesky(activity, target),
      })
    )
  );
  const [entry] = mf2(html, { baseUrl: target }).items;
  const comment = entry.properties.comment?.[0] as {
    properties: Record<string, unknown[]>;
  };
  assert.deepEqual(comment.properties.url, [aliceReply]);
});

test('merging keeps the first copy of a source and sorts newest first', () => {
  const empty: WebmentionGroup = {
    likes: [],
    reposts: [],
    replies: [],
    mentions: [],
    bookmarks: [],
    rsvps: [],
  };
  const bluesky = responsesFromBluesky(activity, target);
  const stored = {
    ...bluesky.replies[0],
    id: 'wm-1',
    publishedAt: new Date('2026-10-01T00:00:00Z'),
  };
  const merged = mergeResponses({ ...empty, replies: [stored] }, bluesky);
  assert.equal(merged?.replies.length, 1, 'one reply per source URL');
  assert.equal(merged?.replies[0].id, 'wm-1', 'the stored webmention wins');
  assert.equal(mergeResponses(null, null), null);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-responses.test.mts`
Expected: FAIL with `Cannot find module '@/lib/atproto/responses'`.

- [ ] **Step 3: Implement.** Create `lib/atproto/responses.ts`:

```ts
import type {} from '@atcute/bluesky';
import { Client, ok, simpleFetchHandler } from '@atcute/client';

import type {
  Webmention,
  WebmentionAuthor,
  WebmentionGroup,
} from '@/lib/indieweb/types';

import { blueskyPostUrl, blueskyProfileUrl } from './bluesky';
import { blueskyAppview } from './config';

const THREAD_VIEW = 'app.bsky.feed.defs#threadViewPost';
/** Labels that keep a post or author off the page. */
const HIDDEN_LABELS = new Set([
  '!hide',
  '!warn',
  'porn',
  'sexual',
  'nudity',
  'graphic-media',
  'gore',
]);

interface Labelled {
  labels?: { val: string }[];
}
interface Profile extends Labelled {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}
interface PostView extends Labelled {
  uri: string;
  indexedAt: string;
  author: Profile;
  record: unknown;
}
interface ThreadNode {
  $type?: string;
  post?: PostView;
  replies?: ThreadNode[];
}
interface Like {
  actor: Profile;
  createdAt: string;
  indexedAt: string;
}

/** What the AppView says about one announcement post. */
export interface BlueskyActivity {
  thread: ThreadNode;
  /** The owner's thread gate: replies hidden from everyone. */
  hiddenReplies: string[];
  likes: Like[];
  reposts: Profile[];
  quotes: PostView[];
}

const hidden = (item: Labelled) =>
  item.labels?.some((label) => HIDDEN_LABELS.has(label.val)) ?? false;
const visible = (post: PostView) => !hidden(post) && !hidden(post.author);

function author(profile: Profile): WebmentionAuthor {
  return {
    name: profile.displayName || profile.handle,
    url: blueskyProfileUrl(profile.did),
    photo: profile.avatar,
  };
}

function fromPost(
  post: PostView,
  type: 'reply' | 'mention',
  target: string
): Webmention {
  const record = post.record as { text?: string; createdAt?: string };
  return {
    id: `bluesky:${post.uri}`,
    sourceUrl: blueskyPostUrl(post.uri),
    targetUrl: target,
    type,
    author: author(post.author),
    content: record.text,
    publishedAt: record.createdAt ? new Date(record.createdAt) : undefined,
    receivedAt: new Date(post.indexedAt),
    isVerified: true,
    isApproved: true,
  };
}

/** A reaction has no permalink, so it cites the reacting account. */
function fromReaction(
  profile: Profile,
  type: 'like' | 'repost',
  target: string,
  at: string
): Webmention {
  return {
    id: `bluesky:${type}:${profile.did}`,
    sourceUrl: blueskyProfileUrl(profile.did),
    targetUrl: target,
    type,
    author: author(profile),
    receivedAt: new Date(at),
    isVerified: true,
    isApproved: true,
  };
}

/**
 * An announcement's Bluesky activity in the webmention shape the page
 * already renders. Direct replies only (the conversation itself lives on
 * Bluesky), minus anything the owner hid or a label keeps off the page.
 */
export function responsesFromBluesky(
  activity: BlueskyActivity,
  target: string
): WebmentionGroup {
  const hiddenReplies = new Set(activity.hiddenReplies);
  const at = activity.thread.post?.indexedAt ?? new Date(0).toISOString();
  return {
    replies: (activity.thread.replies ?? []).flatMap((node) =>
      node.$type === THREAD_VIEW &&
      node.post &&
      !hiddenReplies.has(node.post.uri) &&
      visible(node.post)
        ? [fromPost(node.post, 'reply', target)]
        : []
    ),
    likes: activity.likes
      .filter((like) => !hidden(like.actor))
      .map((like) => ({
        ...fromReaction(like.actor, 'like', target, like.indexedAt),
        publishedAt: new Date(like.createdAt),
      })),
    reposts: activity.reposts
      .filter((profile) => !hidden(profile))
      .map((profile) => fromReaction(profile, 'repost', target, at)),
    mentions: activity.quotes
      .filter(visible)
      .map((quote) => fromPost(quote, 'mention', target)),
    bookmarks: [],
    rsvps: [],
  };
}

/**
 * Everything Bluesky shows for one post, from the configured AppView; null
 * when none is configured.
 */
export async function getBlueskyResponses(
  postUri: string,
  target: string
): Promise<WebmentionGroup | null> {
  const service = blueskyAppview();
  if (!service) return null;
  const rpc = new Client({ handler: simpleFetchHandler({ service }) });
  const uri = postUri as `at://${string}`;
  const [thread, likes, reposts, quotes] = await Promise.all([
    ok(
      rpc.get('app.bsky.feed.getPostThread', {
        params: { uri, depth: 1, parentHeight: 0 },
      })
    ),
    ok(rpc.get('app.bsky.feed.getLikes', { params: { uri, limit: 100 } })),
    ok(rpc.get('app.bsky.feed.getRepostedBy', { params: { uri, limit: 100 } })),
    ok(rpc.get('app.bsky.feed.getQuotes', { params: { uri, limit: 100 } })),
  ]);
  const gate = thread.threadgate?.record as
    | { hiddenReplies?: string[] }
    | undefined;
  return responsesFromBluesky(
    {
      thread: thread.thread as ThreadNode,
      hiddenReplies: gate?.hiddenReplies ?? [],
      likes: likes.likes,
      reposts: reposts.repostedBy,
      quotes: quotes.posts,
    },
    target
  );
}

const when = (item: Webmention) =>
  (item.publishedAt ?? item.receivedAt).getTime();

/**
 * Webmentions and Bluesky activity as one group: one item per source URL
 * (the stored webmention wins, e.g. one sent by Bridgy), newest first.
 */
export function mergeResponses(
  ...groups: (WebmentionGroup | null)[]
): WebmentionGroup | null {
  const present = groups.filter((group): group is WebmentionGroup => !!group);
  if (present.length === 0) return null;
  const merge = (pick: (group: WebmentionGroup) => Webmention[]) => {
    const seen = new Set<string>();
    return present
      .flatMap(pick)
      .filter((item) => {
        if (seen.has(item.sourceUrl)) return false;
        seen.add(item.sourceUrl);
        return true;
      })
      .sort((a, b) => when(b) - when(a));
  };
  return {
    likes: merge((group) => group.likes),
    reposts: merge((group) => group.reposts),
    replies: merge((group) => group.replies),
    mentions: merge((group) => group.mentions),
    bookmarks: merge((group) => group.bookmarks),
    rsvps: merge((group) => group.rsvps),
  };
}
```

If `pnpm typecheck` rejects `likes.likes`, `reposts.repostedBy` or `quotes.posts` against the local structural types, keep the local interfaces and cast at that one call. The structural types exist so that tests can build small fixtures.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-responses.test.mts tests/unit/webmention-display.test.mts`
Expected: PASS. The `webmention-display` tests are unchanged.

- [ ] **Step 5: Wire it into the page.** In `app/writings/[slug]/page.tsx`, add:

```ts
/**
 * Bluesky activity on the writing's announcement, cached like webmentions
 * so it renders inside the h-entry; an AppView failure resolves to nothing.
 */
async function loadBlueskyResponses(
  postUri: string,
  target: string
): Promise<WebmentionGroup | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag('bluesky');
  try {
    return await getBlueskyResponses(postUri, target);
  } catch {
    return null;
  }
}
```

Then, after the `Promise.all` and `canonicalUrl`:

```ts
const blueskyResponses = blueskyCopy
  ? await loadBlueskyResponses(blueskyCopy.uri, canonicalUrl)
  : null;
const responses = mergeResponses(webmentions, blueskyResponses);
```

Pass `webmentions={responses}` to `<PostInteractions>`.

- [ ] **Step 6: Update the docs.** In the webmention display section of `docs/indieweb/README.md`, add:

```markdown
A writing announced on Bluesky also shows that post's direct replies, likes,
reposts, and quote posts, read from the public AppView and merged into the
same lists (`lib/atproto/responses.ts`). They are cached for minutes, like
webmentions. Replies Willie hides on Bluesky stay hidden here, and posts
labelled `!hide`, `!warn`, or as adult or graphic content are left out.
They are merged on the page only: `/webmentions`, the activity feeds, and
moderation see webmentions alone. Do not also turn on Bridgy backfeed for
willie.page. Its webmentions would duplicate these (the stored copy wins a
tie, so nothing shows twice, but every reaction would be stored).
```

Append to the Bluesky section of `docs/atproto.md`:

```markdown
- **Responses:** the writing page reads its document's `bskyPostRef` (cached
  for hours, tag `atproto`, which the post-deploy hook refreshes). It then
  shows the post as `u-syndication`, swaps "Share on Bluesky" for "Reply on
  Bluesky", and lists the post's replies, likes, reposts, and quotes with
  the webmentions (cached for minutes, tag `bluesky`).
```

- [ ] **Step 7: Run the full checks**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: everything passes.

- [ ] **Step 8: Commit and open PR D.** Paths: `lib/atproto/responses.ts "app/writings/[slug]/page.tsx" docs/atproto.md docs/indieweb/README.md tests/unit/atproto-responses.test.mts`. Message: `feat(atproto): Show Bluesky replies and reactions with webmentions`. The PR title is `feat(atproto): Bluesky responses on writings` (Tasks 11 and 12).

---

## Verification after PR D merges

Run this on the first writing that opts in.

1. Make sure `BLUESKY_APPVIEW_URL` is set on Production. Then publish a writing whose `syndicateTo` holds the Bluesky account's uid (its profile URL; `?q=syndicate-to` lists it), or choose Bluesky in a Micropub client.
2. Check the workflow output. The `IndieWeb publish notifications` run shows `"announced":[{"document":"/writings/<slug>","post":"<the post's URL>"}]`.
3. Check the post on Bluesky:
   1. It is on the profile, with a link card that shows the publication's icon and name.
   2. Its rkey equals the document's.
   3. pdsls.dev shows `bskyPostRef` on the document.
4. Check the writing page within an hour:
   1. The byline shows a "Bluesky" `u-syndication` link.
   2. The action reads "Reply on Bluesky".
5. Check that responses arrive. Reply and like from another account. Within minutes, both appear under the writing. Hide the reply on Bluesky, and it disappears after the next cache refresh.
6. Check idempotence. Re-run the workflow. It reports `announced: []`, and Bluesky shows no second post.
