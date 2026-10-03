# standard.site on willie.page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish willie.page as a verified standard.site publication. Every
published writing becomes a `site.standard.document` in Willie's AT Protocol
repo.

**Architecture:** Record keys are TIDs computed from content, so pages emit
their `<link>` tags at build time with no network call. After each production
deploy, the existing post-deploy hook (`/api/indieweb/notify`) runs a sync. The
sync lists the site's own records on the PDS, diffs them against the content
with a pure planner, and applies only the differences with
`com.atproto.repo.applyWrites`. The PDS is the only store.

**Tech Stack:**

- Next.js 16 (App Router, Cache Components), React 19, TypeScript, ESM.
- `@atcute/*` for AT Protocol.
- Node's test runner via `tsx --test`, and Playwright.

Design and roadmap: [specs/2026-10-02-atmosphere-design.md](../specs/2026-10-02-atmosphere-design.md).
Phases 3 (Bluesky posting and comments) and 4 (subscribe and recommend) get
their own plans.

## Global Constraints

- **ESM only.** Use `import`/`export`, and `.mts` for scripts and tests. No
  CommonJS.
- **Package versions:** `@atcute/client` ^5.1.2, `@atcute/password-session`
  ^1.0.2, `@atcute/tid` ^1.1.4, `@atcute/cid` ^2.5.0, `@atcute/lexicons`
  ^2.1.1, `@atcute/atproto` ^4.0.4, `@atcute/standard-site` ^2.0.2,
  `@atcute/identity` ^2.0.2, `@atcute/identity-resolver` ^2.0.2.
- **Nothing deployment-specific is hardcoded inside the app.**
  - The DID, handle, origin, publication record key, app password and
    service endpoints all come from the environment.
  - Only two modules read it: `lib/site.ts` for public values, and
    `lib/atproto/config.ts` for server-only AT Protocol settings.
  - The PDS is resolved from the DID document, never written down.
  - Tests get fixture values from `tests/unit/test.env` (which `pnpm test`
    loads) and derive every expectation from config.
  - Literals are fine only for protocol constants such as lexicon NSIDs, and
    for a test that pins an algorithm's output.
- **The publication record key (`ATPROTO_PUBLICATION_RKEY`) is generated
  once and never changes.** The document key algorithm in
  `lib/atproto/keys.ts` never changes either. Changing either one orphans
  every record.
- **Route handlers only forward to builders in `lib/`.** They use
  Web-standard `Request` and `Response`.
- **A feature whose environment variable is empty turns itself off.** The
  sync reports `skipped`.
- **Records are written only where `ATPROTO_APP_PASSWORD` is set,** which is
  Production only. No origin check is hardcoded: a preview or acceptance
  deployment has no password, so it never writes.
- **Never write to the PDS from tests.** Tests use a fake `RepoClient`.
- **Tests:**
  - Unit tests are `tests/unit/*.test.mts`, using `node:test` and
    `node:assert/strict`, with `@/` imports.
  - Run one file with `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/<name>.test.mts`, and
    all of them with `pnpm test`.
  - Playwright tests are `tests/e2e/*.spec.mts` and import `lib/` relatively.
- **Commits.** Use the `type(atproto): subject` scope, which Task 1 adds. Put
  the message in a file and run the whole chain in one command, ending the
  message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`:

  ```bash
  git restore --staged . && git add <paths> && git commit -F <message-file>
  ```

- **Pull requests:**
  - **PR A** contains Tasks 1 and 2. **PR B** contains Tasks 3 to 7.
  - Each task is one commit, merged with rebase only.
  - No Docket references in PR bodies or commits.
  - Before writing a PR body, check `.github/` for a pull request template.
- **Before finishing each PR,** run `pnpm lint && pnpm typecheck && pnpm test`.

---

## Phase 0: Willie's steps (no code; do before PR B merges)

- [ ] Set `NEXT_PUBLIC_ATPROTO_DID` (the DID) and `NEXT_PUBLIC_BLUESKY_HANDLE` (currently `williecubed.me`) on every Vercel environment that builds the site. The identity fix that moved them out of the code needs them; without the DID, `/.well-known/atproto-did` answers 404 and the site offers no Bluesky account.
- [ ] After PR B's dependencies are installed, generate the publication record key once with `node --input-type=module -e "import { now } from '@atcute/tid'; console.log(now())"`. Set the output as `ATPROTO_PUBLICATION_RKEY` on every environment that builds the site, because pages name the publication in their HTML. Never change it afterwards.
- [ ] In Bluesky, go to Settings, then Privacy and security, then App passwords, and create one named `willie.page sync`. Add it to Vercel as `ATPROTO_APP_PASSWORD`, scoped to **Production** only and not Preview.
- [ ] Sign in at https://pdsls.dev, open `app.bsky.actor.profile/self`, add `"website": "https://willie.page"`, and save.
- [ ] Make sure the Vercel Firewall does not challenge `/.well-known/*`, `/writings/*/opengraph-image` or `/brand/social/*`.

---

## PR A: AT Protocol identity

### Task 1: Bluesky among the site's profiles, and the `atproto` commit scope

**Files:**

- Modify: `lib/site.ts` (`social`)
- Create: `components/icons/BlueskyIcon.tsx`
- Modify: `components/site/SiteFooter.tsx:39-52` (`SocialIcon`)
- Modify: `docs/commits.md` (scopes list)
- Test: `tests/unit/seo-jsonld.test.mts`

**Interfaces:**

- Consumes: `blueskyAccount` in `lib/site.ts`. It is built from `NEXT_PUBLIC_ATPROTO_DID` and `NEXT_PUBLIC_BLUESKY_HANDLE`, and is `undefined` without a DID. It is already on `main`, from the identity fix.
- Produces: when the account is configured, `site.social` gains `{ label: 'Bluesky', href: blueskyAccount.profile }`. The JSON-LD `sameAs`, the footer's `rel="me"` links, the palette, and the MCP `social` field all read `site.social`, so each picks it up with no further change.

- [ ] **Step 1: Write the failing test.** Append to `tests/unit/seo-jsonld.test.mts`:

```ts
test('the Bluesky profile is a rel="me" profile and the syndication target', () => {
  const bluesky = site.syndication.find(
    (account) => account.service === 'Bluesky'
  );
  assert.ok(bluesky, 'tests/unit/test.env configures the account');
  assert.ok(
    site.social.some((profile) => profile.href === bluesky.profile),
    'site.social lists the Bluesky profile'
  );
  assert.ok((personLd().sameAs as string[]).includes(bluesky.profile));
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/seo-jsonld.test.mts`
Expected: FAIL with `site.social lists the Bluesky profile`.

- [ ] **Step 3: Implement.** In `lib/site.ts`, append this to `social`, after Instagram. Adding it last keeps the footer's collapsed row (`KEPT`) unchanged:

```ts
    ...(blueskyAccount
      ? [{ label: 'Bluesky', href: blueskyAccount.profile }]
      : []),
```

Create `components/icons/BlueskyIcon.tsx`:

```tsx
export default function BlueskyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 600 530"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"
        fill="currentColor"
      />
    </svg>
  );
}
```

In `components/site/SiteFooter.tsx`, import it and add a case to `SocialIcon` before `default`:

```tsx
    case 'Bluesky':
      return <BlueskyIcon className="size-4" />;
```

In `docs/commits.md`, add this after the `protocols` bullet:

```markdown
- **`atproto`** — AT Protocol identity and records: `lib/atproto`, standard.site publishing, and the Bluesky integration; see `docs/atproto.md`
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/seo-jsonld.test.mts`
Expected: PASS. The existing `sameAs` deep-equal test still passes, because it compares `sameAs` against `site.social` itself.

- [ ] **Step 5: Check the footer by eye.** Run `pnpm dev`, open `/`, expand the footer, and confirm Bluesky shows with its icon and `rel="me"`.

- [ ] **Step 6: Commit.** Paths: `lib/site.ts components/icons/BlueskyIcon.tsx components/site/SiteFooter.tsx docs/commits.md tests/unit/seo-jsonld.test.mts`. Message: `feat(atproto): List the Bluesky profile among the site's profiles`.

### Task 2: "Share on Bluesky" post action

**Files:**

- Modify: `lib/indieweb/posse.ts`
- Modify: `components/writings/PostActions.tsx`, `components/writings/PostInteractions.tsx`
- Test: `tests/unit/post-share.test.mts`

**Interfaces:**

- Produces: `blueskyPostIntent(writing: Pick<WritingData, 'title' | 'description' | 'hasExplicitTitle'>, originalUrl: string): string`

- [ ] **Step 1: Write the failing test.** Append to `tests/unit/post-share.test.mts`, and add `blueskyPostIntent` to its import:

```ts
test('a Bluesky draft carries the share text and the original URL', () => {
  const intent = new URL(
    blueskyPostIntent(
      {
        title: 'A longer article',
        description: 'A summary of the article.',
        hasExplicitTitle: true,
      },
      original
    )
  );

  assert.equal(intent.origin, 'https://bsky.app');
  assert.equal(intent.pathname, '/intent/compose');
  assert.equal(
    intent.searchParams.get('text'),
    `A longer article\n\n${original}`
  );
});

test('a note shares its own words on Bluesky', () => {
  const intent = new URL(
    blueskyPostIntent(
      {
        title: 'A note',
        description: 'A note about the site.',
        hasExplicitTitle: false,
      },
      original
    )
  );

  assert.equal(
    intent.searchParams.get('text'),
    `A note about the site.\n\n${original}`
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/post-share.test.mts`
Expected: FAIL with a SyntaxError, because `blueskyPostIntent` is not exported.

- [ ] **Step 3: Implement.** Replace `lib/indieweb/posse.ts` with:

```ts
import type { WritingData } from '@/lib/writings';

type Shareable = Pick<
  WritingData,
  'title' | 'description' | 'hasExplicitTitle'
>;

/** An article is shared by its headline; a note by its own words. */
function shareText(writing: Shareable): string {
  return writing.hasExplicitTitle ? writing.title : writing.description;
}

export function threadsPostIntent(
  writing: Shareable,
  originalUrl: string
): string {
  const intent = new URL('https://www.threads.com/intent/post');
  intent.searchParams.set('text', shareText(writing));
  intent.searchParams.set('url', originalUrl);
  return intent.toString();
}

/**
 * Bluesky's compose intent takes only text, so the URL rides at the end,
 * where the composer turns it into a link card.
 */
export function blueskyPostIntent(
  writing: Shareable,
  originalUrl: string
): string {
  const intent = new URL('https://bsky.app/intent/compose');
  intent.searchParams.set('text', `${shareText(writing)}\n\n${originalUrl}`);
  return intent.toString();
}
```

In `components/writings/PostActions.tsx`:

- add `blueskyHref: string;` to `PostActionsProps`, and destructure it;
- import `BlueskyIcon from '@/components/icons/BlueskyIcon'`;
- insert this before the Threads `SiteLink`:

```tsx
<SiteLink
  href={blueskyHref}
  target="_blank"
  data-post-action
  className={secondaryAction}
>
  <BlueskyIcon className="size-4" />
  Share on Bluesky
</SiteLink>
```

In `components/writings/PostInteractions.tsx`, import `blueskyPostIntent` alongside `threadsPostIntent`, and pass `blueskyHref={blueskyPostIntent(writing, target)}` to `<PostActions>`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/post-share.test.mts && pnpm typecheck`
Expected: PASS, with no type errors.

- [ ] **Step 5: Commit.** Paths: `lib/indieweb/posse.ts components/writings/PostActions.tsx components/writings/PostInteractions.tsx tests/unit/post-share.test.mts`. Message: `feat(atproto): Offer a Bluesky share draft under each writing`.

- [ ] **Step 6: Open PR A** (Tasks 1 and 2). Its title is `feat(atproto): Bluesky identity on the site`.

---

## PR B: standard.site publishing

### Task 3: Dependencies, configuration, and computed record keys

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml` (via `pnpm add`), `tests/unit/test.env` (a fixture publication key)
- Create: `lib/atproto/config.ts`, `lib/atproto/keys.ts`
- Test: `tests/unit/atproto-keys.test.mts`

**Interfaces:**

- Produces from `lib/atproto/config.ts`, the only module besides `lib/site.ts` that reads the environment:
  - `ATPROTO_DID: Did | undefined`, which is `site.author.atprotoDid`;
  - `PUBLICATION_COLLECTION`, `DOCUMENT_COLLECTION`, and the type `Collection`;
  - `PUBLICATION_RKEY: string | undefined`, from `ATPROTO_PUBLICATION_RKEY` and checked to be a TID;
  - `PUBLICATION_URI: string | undefined`, set when both the DID and the key are;
  - `publishingIdentity(): { did: Did; publicationRkey: string; publicationUri: string }`, which throws when either is unset;
  - `appPassword(): string | undefined`, which reads `ATPROTO_APP_PASSWORD` when called.
- Produces from `lib/atproto/keys.ts`:
  - `documentRkey(path: string, published: Date): string`
  - `documentUri(path: string, published: Date): string | undefined`, which is undefined without a DID.

- [ ] **Step 1: Install**

Run: `pnpm add @atcute/client@^5.1.2 @atcute/password-session@^1.0.2 @atcute/tid@^1.1.4 @atcute/cid@^2.5.0 @atcute/lexicons@^2.1.1 @atcute/atproto@^4.0.4 @atcute/standard-site@^2.0.2`
Expected: all seven are added under `dependencies`.

- [ ] **Step 2: Add the fixture and write the failing test.** Append a fixture key to `tests/unit/test.env`. It is a valid TID and names no real record:

```bash
ATPROTO_PUBLICATION_RKEY=3khuwc44c222b
```

Create `tests/unit/atproto-keys.test.mts`:

```ts
import * as TID from '@atcute/tid';
import assert from 'node:assert/strict';
import test from 'node:test';

import { publishingIdentity } from '@/lib/atproto/config';
import { documentRkey, documentUri } from '@/lib/atproto/keys';
import { site } from '@/lib/site';

const published = new Date('2026-09-23T18:51:00-07:00');

test('the publication lives at the configured key in the owner’s repo', () => {
  const { did, publicationRkey, publicationUri } = publishingIdentity();
  assert.equal(did, site.author.atprotoDid);
  assert.ok(TID.validate(publicationRkey));
  assert.equal(
    publicationUri,
    `at://${did}/site.standard.publication/${publicationRkey}`
  );
});

test('a document key encodes its publish time and never drifts', () => {
  const key = documentRkey('/writings/fall-tour-2026-begins', published);
  assert.ok(TID.validate(key));
  assert.equal(TID.parse(key).timestamp, published.getTime() * 1000);
  // Pinned: a different key here would orphan every published record.
  assert.equal(key, '3mwa5ei54c22g');
});

test('two writings published the same minute get different keys', () => {
  assert.notEqual(
    documentRkey('/writings/a', published),
    documentRkey('/writings/b', published)
  );
});

test('a document URI names the document collection in the owner’s repo', () => {
  assert.equal(
    documentUri('/writings/fall-tour-2026-begins', published),
    `at://${site.author.atprotoDid}/site.standard.document/3mwa5ei54c22g`
  );
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-keys.test.mts`
Expected: FAIL with `Cannot find module '@/lib/atproto/config'`.

- [ ] **Step 4: Implement.** Create `lib/atproto/config.ts`. It uses a relative import, like `lib/indieweb/constants.ts`, so Playwright can load it:

```ts
import type { Did } from '@atcute/lexicons';
import * as TID from '@atcute/tid';

import { site } from '../site';

/**
 * Server-only AT Protocol settings. With lib/site.ts, this is the only
 * module that reads the environment; everything else asks it.
 */

/** The account every record lives in: the DID /.well-known/atproto-did serves. */
export const ATPROTO_DID = site.author.atprotoDid as Did | undefined;

export const PUBLICATION_COLLECTION = 'site.standard.publication';
export const DOCUMENT_COLLECTION = 'site.standard.document';
export type Collection =
  | typeof PUBLICATION_COLLECTION
  | typeof DOCUMENT_COLLECTION;

/**
 * The publication's record key: a TID generated once and kept in the
 * environment, so every page can name the record without asking the PDS.
 * Never change it: subscriptions and documents point at this URI.
 */
export const PUBLICATION_RKEY =
  process.env.ATPROTO_PUBLICATION_RKEY || undefined;
if (PUBLICATION_RKEY && !TID.validate(PUBLICATION_RKEY)) {
  throw new Error('ATPROTO_PUBLICATION_RKEY must be a TID.');
}

/** The publication's AT-URI, while both the DID and the key are set. */
export const PUBLICATION_URI: `at://${string}` | undefined =
  ATPROTO_DID && PUBLICATION_RKEY
    ? `at://${ATPROTO_DID}/${PUBLICATION_COLLECTION}/${PUBLICATION_RKEY}`
    : undefined;

/** What writing records needs; throws when the environment leaves it out. */
export function publishingIdentity(): {
  did: Did;
  publicationRkey: string;
  publicationUri: `at://${string}`;
} {
  if (!ATPROTO_DID || !PUBLICATION_RKEY || !PUBLICATION_URI) {
    throw new Error(
      'Set NEXT_PUBLIC_ATPROTO_DID and ATPROTO_PUBLICATION_RKEY to publish.'
    );
  }
  return {
    did: ATPROTO_DID,
    publicationRkey: PUBLICATION_RKEY,
    publicationUri: PUBLICATION_URI,
  };
}

/** The app password the sync signs in with; set on Production only. */
export function appPassword(): string | undefined {
  return process.env.ATPROTO_APP_PASSWORD || undefined;
}
```

Create `lib/atproto/keys.ts`:

```ts
import * as TID from '@atcute/tid';

import { ATPROTO_DID, DOCUMENT_COLLECTION } from './config';

/** 32-bit FNV-1a: a stable spread of paths across TID clock IDs. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * A document's record key, computed rather than stored: the publish time
 * in microseconds, with a clock ID taken from the path. The page and the
 * sync both derive it, so the <link> tag ships with the build and nothing
 * maps posts to records. A new `published` time or slug gives a new key,
 * and the sync then moves the record (lib/atproto/plan.ts).
 */
export function documentRkey(path: string, published: Date): string {
  return TID.create(published.getTime() * 1000, fnv1a(path) & 1023);
}

/** A document's AT-URI, or undefined while no DID is configured. */
export function documentUri(path: string, published: Date): string | undefined {
  return ATPROTO_DID
    ? `at://${ATPROTO_DID}/${DOCUMENT_COLLECTION}/${documentRkey(path, published)}`
    : undefined;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-keys.test.mts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit.** Paths: `package.json pnpm-lock.yaml tests/unit/test.env lib/atproto/config.ts lib/atproto/keys.ts tests/unit/atproto-keys.test.mts`. Message: `feat(atproto): Compute standard.site record keys from content`.

### Task 4: Plain text and the record builders

**Files:**

- Create: `lib/text/strip-mdx.ts`. Move `stripMdxSyntax` here from `lib/search/collect.ts:19-60`, exported and unchanged.
- Modify: `lib/search/collect.ts` (import it from the new file; delete the local copy)
- Create: `lib/atproto/records.ts`
- Test: `tests/unit/atproto-records.test.mts`

**Interfaces:**

- Consumes: `publishingIdentity` (Task 3).
- Produces:
  - `stripMdxSyntax(content: string): string`
  - `interface DocumentSource { slug; title; description; published: Date; lastUpdated: Date; tags: string[]; body: string; image?: string }`
  - `interface DocumentExtras { coverImage?: Blob; bskyPostRef?: ComAtprotoRepoStrongRef.Main }`
  - `documentPath(slug: string): string`
  - `publicationRecord(icon?: Blob): SiteStandardPublication.Main`
  - `documentRecord(source: DocumentSource, extras?: DocumentExtras): SiteStandardDocument.Main`

- [ ] **Step 1: Write the failing test.** Create `tests/unit/atproto-records.test.mts`:

```ts
import { safeParse } from '@atcute/lexicons';
import {
  SiteStandardDocument,
  SiteStandardPublication,
} from '@atcute/standard-site';
import assert from 'node:assert/strict';
import test from 'node:test';

import { publishingIdentity } from '@/lib/atproto/config';
import {
  type DocumentSource,
  documentRecord,
  publicationRecord,
} from '@/lib/atproto/records';
import { site } from '@/lib/site';
import { themeSchemes } from '@/lib/theme';

const blob = {
  $type: 'blob' as const,
  ref: { $link: 'bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq' },
  mimeType: 'image/png',
  size: 5,
};

const article: DocumentSource = {
  slug: 'fall-tour-2026-begins',
  title: 'Fall Tour 2026 begins',
  description: 'Where I am going and why.',
  published: new Date('2026-09-23T18:51:00-07:00'),
  lastUpdated: new Date('2026-09-23T18:51:00-07:00'),
  tags: ['#travel', 'transit'],
  body: '# Heading\n\nSome **bold** words and [a link](https://example.com).\n\n<Callout>Kept text</Callout>',
};

test('the publication record is valid and wears the site theme', () => {
  const record = publicationRecord(blob);
  const result = safeParse(SiteStandardPublication.mainSchema, record);
  assert.ok(result.ok, result.ok ? '' : result.message);
  assert.equal(record.url, site.origin);
  assert.ok(!record.url.endsWith('/'));
  assert.equal(record.name, site.name);
  assert.deepEqual(record.icon, blob);
  assert.equal(
    record.basicTheme?.background.$type,
    'site.standard.theme.color#rgb'
  );
  const surface = Number.parseInt(themeSchemes.light.surface.slice(1), 16);
  assert.equal(record.basicTheme?.background.r, (surface >> 16) & 255);
});

test('an article becomes a valid document under the publication', () => {
  const record = documentRecord(article, { coverImage: blob });
  const result = safeParse(SiteStandardDocument.mainSchema, record);
  assert.ok(result.ok, result.ok ? '' : result.message);
  assert.equal(record.site, publishingIdentity().publicationUri);
  assert.equal(record.path, '/writings/fall-tour-2026-begins');
  assert.equal(record.publishedAt, '2026-09-24T01:51:00.000Z');
  assert.equal(record.updatedAt, undefined, 'never edited');
  assert.deepEqual(record.tags, ['travel', 'transit']);
  assert.equal(
    record.textContent,
    'Heading\n\nSome bold words and a link.\n\nKept text'
  );
  assert.deepEqual(record.coverImage, blob);
});

test('an edit sets updatedAt', () => {
  const record = documentRecord({
    ...article,
    lastUpdated: new Date('2026-10-01T09:00:00Z'),
  });
  assert.equal(record.updatedAt, '2026-10-01T09:00:00.000Z');
});

test('a note drops a description that only repeats its title', () => {
  const record = documentRecord({
    ...article,
    slug: 'a-note',
    title: 'A note about the site.',
    description: 'A note about the site.',
    tags: [],
    body: 'A note about the site.',
  });
  assert.equal(record.description, undefined);
  assert.equal(record.tags, undefined);
});

test('a long derived title is clipped to the lexicon limit', () => {
  const record = documentRecord({ ...article, title: '🌵'.repeat(600) });
  assert.equal([...new Intl.Segmenter().segment(record.title)].length, 500);
  assert.ok(record.title.endsWith('…'));
});

test('a known Bluesky post reference is carried on the record', () => {
  const bskyPostRef = {
    uri: `at://${site.author.atprotoDid}/app.bsky.feed.post/3mwa5ei54c22g`,
    cid: 'bafyreihffx5a2e7k5uwrmmgofbvzujc5cmw5h4espouwuxt3liqoflx3ee',
  } as const;
  assert.deepEqual(
    documentRecord(article, { bskyPostRef }).bskyPostRef,
    bskyPostRef
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-records.test.mts`
Expected: FAIL with `Cannot find module '@/lib/atproto/records'`.

- [ ] **Step 3: Move `stripMdxSyntax`.** Create `lib/text/strip-mdx.ts` holding the function from `lib/search/collect.ts:16-60`, verbatim, with `export` and its doc comment ("Strips MDX/Markdown syntax… plain text"). In `lib/search/collect.ts`, delete the local function and add `import { stripMdxSyntax } from '@/lib/text/strip-mdx';`.

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/search-collect.test.mts`
Expected: PASS, with no change in search behavior.

- [ ] **Step 4: Implement the builders.** Create `lib/atproto/records.ts`:

```ts
import type { ComAtprotoRepoStrongRef } from '@atcute/atproto';
import type { Blob } from '@atcute/lexicons';
import type {
  SiteStandardDocument,
  SiteStandardPublication,
} from '@atcute/standard-site';

import { site } from '@/lib/site';
import { stripMdxSyntax } from '@/lib/text/strip-mdx';
import { themeSchemes } from '@/lib/theme';

import { publishingIdentity } from './config';

/** A published writing, already loaded, in the shape a document needs. */
export interface DocumentSource {
  slug: string;
  title: string;
  description: string;
  published: Date;
  lastUpdated: Date;
  tags: string[];
  /** The MDX body. */
  body: string;
  /** `featuredImage`, when the writing sets one. */
  image?: string;
}

export interface DocumentExtras {
  coverImage?: Blob;
  /** The Bluesky post announcing the document (Phase 3). */
  bskyPostRef?: ComAtprotoRepoStrongRef.Main;
}

export function documentPath(slug: string): string {
  return `/writings/${slug}`;
}

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

/** Cuts text to a lexicon's grapheme limit, ending on an ellipsis if it cut. */
function clip(text: string, max: number): string {
  const parts = [...graphemes.segment(text)];
  if (parts.length <= max) return text;
  return `${parts
    .slice(0, max - 1)
    .map(({ segment }) => segment)
    .join('')}…`;
}

/** `#2f6f5e` as the lexicon's RGB color. */
function rgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    $type: 'site.standard.theme.color#rgb' as const,
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

/**
 * The site as a standard.site publication. `url` is the origin with no
 * trailing slash; a document's canonical URL is `url` + `path`.
 */
export function publicationRecord(icon?: Blob): SiteStandardPublication.Main {
  const colors = themeSchemes.light;
  return {
    $type: 'site.standard.publication',
    name: site.name,
    url: site.origin as SiteStandardPublication.Main['url'],
    description: site.description,
    ...(icon && { icon }),
    basicTheme: {
      $type: 'site.standard.theme.basic',
      background: rgb(colors.surface),
      foreground: rgb(colors.onSurface),
      accent: rgb(colors.primary),
      accentForeground: rgb(colors.onPrimary),
    },
    preferences: { showInDiscover: true },
  };
}

/**
 * A writing as a standard.site document. `content` is left out on
 * purpose: the site renders its own HTML and readers link to it, while
 * `textContent` gives them the whole text for search and reading time.
 */
export function documentRecord(
  source: DocumentSource,
  extras: DocumentExtras = {}
): SiteStandardDocument.Main {
  const tags = source.tags
    .map((tag) => clip(tag.replace(/^#+/, '').trim(), 128))
    .filter(Boolean);
  const edited = source.lastUpdated.getTime() > source.published.getTime();
  return {
    $type: 'site.standard.document',
    site: publishingIdentity().publicationUri,
    path: documentPath(source.slug),
    title: clip(source.title, 500),
    ...(source.description &&
      source.description !== source.title && {
        description: clip(source.description, 3000),
      }),
    publishedAt: source.published.toISOString(),
    ...(edited && { updatedAt: source.lastUpdated.toISOString() }),
    ...(tags.length > 0 && { tags }),
    textContent: stripMdxSyntax(source.body),
    ...(extras.coverImage && { coverImage: extras.coverImage }),
    ...(extras.bskyPostRef && { bskyPostRef: extras.bskyPostRef }),
  };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-records.test.mts && pnpm typecheck`
Expected: PASS, 6 tests, with no type errors.

If `textContent` differs only in whitespace, the test is pinning `stripMdxSyntax`'s existing output. Fix the expected string to match that output; do not change the function.

- [ ] **Step 6: Commit.** Paths: `lib/text/strip-mdx.ts lib/search/collect.ts lib/atproto/records.ts tests/unit/atproto-records.test.mts`. Message: `feat(atproto): Build standard.site publication and document records`.

### Task 5: Discovery: the well-known route and the link tags

**Files:**

- Create: `app/.well-known/site.standard.publication/route.ts`
- Modify: `app/layout.tsx:118` (after the JSON Feed alternate `<link>`)
- Modify: `app/writings/[slug]/page.tsx:213` (right after `<JsonLd … />`)
- Modify: `lib/indieweb/discovery.ts` (`buildLlmsSummary`, the `## Protocols` list), `lib/humans-txt.ts` (`HUMANS_STANDARDS`)
- Create: `docs/atproto.md`
- Modify: `docs/index.md` (IndieWeb section), `docs/indieweb/README.md` (Routes table, after the `atproto-did` row)
- Test: `tests/unit/atproto-discovery.test.mts`, `tests/e2e/indieweb.spec.mts`

**Interfaces:**

- Consumes: `PUBLICATION_URI` and `publishingIdentity` (Task 3), `documentUri` (Task 3). Every tag and the route are left out, or answer 404, while `PUBLICATION_URI` or the DID is unset.

- [ ] **Step 1: Write the failing unit test.** Create `tests/unit/atproto-discovery.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { publishingIdentity } from '@/lib/atproto/config';
import { HUMANS_STANDARDS } from '@/lib/humans-txt';
import { buildLlmsSummary } from '@/lib/indieweb/discovery';
import { site } from '@/lib/site';

test('the publication well-known answers with the AT-URI alone', async () => {
  const { GET } =
    await import('@/app/.well-known/site.standard.publication/route');
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), publishingIdentity().publicationUri);
  assert.match(response.headers.get('Content-Type') ?? '', /^text\/plain/);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('llms.txt and humans.txt name the AT Protocol endpoints', () => {
  const llms = buildLlmsSummary();
  assert.ok(
    llms.includes(`${site.origin}/.well-known/site.standard.publication`)
  );
  assert.ok(llms.includes(`${site.origin}/.well-known/atproto-did`));
  assert.ok(HUMANS_STANDARDS.includes('standard.site'));
  assert.ok(HUMANS_STANDARDS.includes('AT Protocol'));
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-discovery.test.mts`
Expected: FAIL with `Cannot find module '@/app/.well-known/site.standard.publication/route'`.

- [ ] **Step 3: Implement the route, llms.txt and humans.txt.** Create `app/.well-known/site.standard.publication/route.ts`:

```ts
import { PUBLICATION_URI } from '@/lib/atproto/config';

/**
 * standard.site verification: the AT-URI of the publication this origin
 * hosts, and nothing else. Readers compare it with the record's `url`.
 * 404 while the publication is not configured.
 */
export async function GET() {
  if (!PUBLICATION_URI) return new Response('Not found', { status: 404 });
  return new Response(PUBLICATION_URI, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
```

In `lib/indieweb/discovery.ts`, add these after the `WebFinger` entry in the `## Protocols` list:

```ts
      llmsLink(
        'AT Protocol DID',
        '/.well-known/atproto-did',
        'the AT Protocol DID behind the site’s Bluesky account'
      ),
      llmsLink(
        'standard.site publication',
        '/.well-known/site.standard.publication',
        'the AT-URI of the publication record every writing belongs to'
      ),
```

In `lib/humans-txt.ts`, add `'AT Protocol'` and `'standard.site'` after `'WebFinger'` in `HUMANS_STANDARDS`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-discovery.test.mts tests/unit/indieweb-discovery.test.mts tests/unit/humans-txt.test.mts`
Expected: PASS. The llmstxt.org shape test still passes.

- [ ] **Step 5: Add the link tags.** In `app/layout.tsx`, add this after the `application/feed+json` alternate `<link>`, importing `PUBLICATION_URI` from `@/lib/atproto/config`:

<!-- prettier-ignore -->
```tsx
        {/* standard.site: the AT Protocol publication this site is.
            /.well-known/site.standard.publication confirms it. */}
        {PUBLICATION_URI && (
          <link rel="site.standard.publication" href={PUBLICATION_URI} />
        )}
```

In `app/writings/[slug]/page.tsx`, import `documentUri` from `@/lib/atproto/keys`, compute `const documentAt = documentUri(path, writing.published);` next to `path`, and add this right after the `<JsonLd … />` element:

<!-- prettier-ignore -->
```tsx
      {/* standard.site: this writing's record. React hoists it into
          <head>, where verifiers read it without running scripts. */}
      {documentAt && <link rel="site.standard.document" href={documentAt} />}
```

- [ ] **Step 6: Write the e2e test.** Append to `tests/e2e/indieweb.spec.mts`, adding `import { PUBLICATION_URI } from '../../lib/atproto/config';` to the imports:

```ts
test('standard.site discovery names the publication and each document', async ({
  request,
}) => {
  // The test process reads the same environment the server was built with.
  test.skip(!PUBLICATION_URI, 'the AT Protocol publication is not configured');
  const wellKnown = await request.get('/.well-known/site.standard.publication');
  expect(wellKnown.status()).toBe(200);
  expect(await wellKnown.text()).toBe(PUBLICATION_URI);

  const home = await (await request.get('/')).text();
  expect(home.slice(0, home.indexOf('</head>'))).toContain(
    `<link rel="site.standard.publication" href="${PUBLICATION_URI}"/>`
  );

  const index = await (await request.get('/writings')).text();
  const slug = index.match(/href="\/writings\/(?!tags\/|feed)([^"/?#]+)"/)?.[1];
  test.skip(!slug, 'no writing is published yet');
  const page = await (await request.get(`/writings/${slug}`)).text();
  const head = page.slice(0, page.indexOf('</head>'));
  expect(head).toContain(
    `<link rel="site.standard.publication" href="${PUBLICATION_URI}"/>`
  );
  expect(head).toMatch(
    new RegExp(
      `<link rel="site\\.standard\\.document" href="at://${site.author.atprotoDid}/site\\.standard\\.document/[2-7a-j][2-7a-z]{12}"/>`
    )
  );
});
```

- [ ] **Step 7: Run the e2e test**

Run: `pnpm build && pnpm exec playwright test tests/e2e/indieweb.spec.mts -g "standard.site"`, with `NEXT_PUBLIC_ATPROTO_DID` and `ATPROTO_PUBLICATION_RKEY` set in `.env.local` (the fixture values from `tests/unit/test.env` will do).
Expected: PASS. Without those values the test skips, as it does in CI, and the document part is skipped while every writing is a draft. Then check the document tag by hand against a dev server, where drafts render: run `pnpm dev`, then `curl -s localhost:3000/writings/fall-tour-2026-begins | grep -o '<link rel="site.standard[^>]*>'`. Expected: two tags, the publication and the document.

- [ ] **Step 8: Write the docs.** Create `docs/atproto.md`:

```markdown
# AT Protocol

The site is an AT Protocol identity and a [standard.site][standard]
publication: every published writing has a signed record in the owner's repo
that Atmosphere readers can find. Design and roadmap: [the Atmosphere
spec](./superpowers/specs/2026-10-02-atmosphere-design.md).

## Configuration

Nothing here is hardcoded: every value comes from the environment, read only
in `lib/site.ts` and `lib/atproto/config.ts`. Each feature turns off when its
values are unset.

| Variable                     | What it is                                                           | Where it must be set          |
| ---------------------------- | -------------------------------------------------------------------- | ----------------------------- |
| `NEXT_PUBLIC_ATPROTO_DID`    | The owner's DID; `/.well-known/atproto-did` serves it                | every environment that builds |
| `NEXT_PUBLIC_BLUESKY_HANDLE` | The handle shown beside the Bluesky account                          | every environment that builds |
| `ATPROTO_PUBLICATION_RKEY`   | The publication's record key, a TID generated once and never changed | every environment that builds |
| `ATPROTO_APP_PASSWORD`       | The app password the post-deploy sync writes with                    | Production only               |

## Identity

- The site links to the Bluesky profile by DID, so its links survive a
  handle change.
- The handle is whatever domain the DID document names. To move it to this
  site's domain, add `TXT _atproto.<domain> "did=…"` for the DID, change the
  handle in Bluesky, and update `NEXT_PUBLIC_BLUESKY_HANDLE`. Followers and
  posts stay, because they belong to the DID.
- Keep `did:plc`. A `did:web` identity cannot move to another domain or
  recover from losing this one.

## standard.site

| What                                           | Where                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Publication record                             | `site.standard.publication/<ATPROTO_PUBLICATION_RKEY>`, built by `publicationRecord` |
| One document per published writing (notes too) | `site.standard.document/<computed TID>`, built by `documentRecord`                   |
| Verification                                   | `/.well-known/site.standard.publication` returns the publication URI                 |
| Publication tag on every page                  | `<link rel="site.standard.publication">` in `app/layout.tsx`                         |
| Document tag on every writing                  | `<link rel="site.standard.document">` in `app/writings/[slug]/page.tsx`              |

Record keys are computed (`lib/atproto/keys.ts`): the publish time in
microseconds plus a clock ID from the path. **Do not change a writing's
`published` time or slug after it is announced on Bluesky.** The sync would
move the record, but the Bluesky post's card would still point at the old one.

Records leave out `content`, because the site renders its own HTML.
`textContent` holds the full plain text.

[standard]: https://standard.site
```

Add this to `docs/index.md` under `## IndieWeb`:

```markdown
- [AT Protocol](./atproto.md): the Bluesky handle, the standard.site
  publication and documents, and how the sync writes them.
```

Add this row to the Routes table in `docs/indieweb/README.md`, after `/.well-known/atproto-did`:

```markdown
| `/.well-known/site.standard.publication` | standard.site verification: the AT-URI of the publication record; see [atproto.md](../atproto.md) | nothing |
```

Then run `pnpm exec prettier --write docs/indieweb/README.md docs/atproto.md` so the table columns line up.

- [ ] **Step 9: Commit.** Paths: `app/.well-known/site.standard.publication/route.ts app/layout.tsx "app/writings/[slug]/page.tsx" lib/indieweb/discovery.ts lib/humans-txt.ts docs/atproto.md docs/index.md docs/indieweb/README.md tests/unit/atproto-discovery.test.mts tests/e2e/indieweb.spec.mts`. Message: `feat(atproto): Advertise the standard.site publication and documents`.

### Task 6: The sync planner

**Files:**

- Create: `lib/atproto/types.ts`, `lib/atproto/plan.ts`
- Test: `tests/unit/atproto-plan.test.mts`

**Interfaces:**

- Consumes: the `Collection` constants and `publishingIdentity` (Task 3).
- Produces from `lib/atproto/types.ts`:
  - `LocalBlob { ref: Blob; bytes: Uint8Array }`
  - `RecordValue`, which is `SiteStandardPublication.Main | SiteStandardDocument.Main`
  - `DesiredRecord { collection: Collection; rkey: string; value: RecordValue; blobs: LocalBlob[] }`
  - `ExistingRecord { collection: Collection; rkey: string; cid: string; value: Record<string, unknown> }`
  - `Write`, a union of the three `com.atproto.repo.applyWrites` operations
  - `RepoClient { listRecords(c): Promise<ExistingRecord[]>; applyWrites(w): Promise<void>; uploadBlob(b): Promise<void>; close(): Promise<void> }`
- Produces from `lib/atproto/plan.ts`:
  - `SyncPlan { writes: Write[]; uploads: LocalBlob[]; unchanged: number }`
  - `planSync(desired: DesiredRecord[], existing: ExistingRecord[]): SyncPlan`

- [ ] **Step 1: Write the failing test.** Create `tests/unit/atproto-plan.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOCUMENT_COLLECTION,
  PUBLICATION_COLLECTION,
  publishingIdentity,
} from '@/lib/atproto/config';
import { planSync } from '@/lib/atproto/plan';
import type {
  DesiredRecord,
  ExistingRecord,
  LocalBlob,
} from '@/lib/atproto/types';

// The fixture identity from tests/unit/test.env.
const { publicationRkey: PUBLICATION_RKEY, publicationUri: PUBLICATION_URI } =
  publishingIdentity();

const cover: LocalBlob = {
  bytes: new Uint8Array([1]),
  ref: {
    $type: 'blob',
    ref: {
      $link: 'bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq',
    },
    mimeType: 'image/png',
    size: 1,
  },
};

function publication(): DesiredRecord {
  return {
    collection: PUBLICATION_COLLECTION,
    rkey: PUBLICATION_RKEY,
    value: {
      $type: 'site.standard.publication',
      name: 'Site',
      url: 'https://example.com',
    },
    blobs: [],
  };
}

function doc(rkey: string, path: string, title = 'Title'): DesiredRecord {
  return {
    collection: DOCUMENT_COLLECTION,
    rkey,
    value: {
      $type: 'site.standard.document',
      site: PUBLICATION_URI,
      path,
      title,
      publishedAt: '2026-10-01T00:00:00.000Z',
      coverImage: cover.ref,
    },
    blobs: [cover],
  };
}

/** What the PDS would list back after a record was written. */
function stored(record: DesiredRecord): ExistingRecord {
  return {
    collection: record.collection,
    rkey: record.rkey,
    cid: 'bafyrei-stored',
    value: JSON.parse(JSON.stringify(record.value)),
  };
}

const ref = {
  uri: 'at://did:plc:x/app.bsky.feed.post/3abc',
  cid: 'bafyrei-post',
};

test('an empty repo gets the publication and every document', () => {
  const plan = planSync(
    [publication(), doc('3mwa5ei54c22g', '/writings/a')],
    []
  );
  assert.deepEqual(
    plan.writes.map((write) => [write.$type, write.collection, write.rkey]),
    [
      [
        'com.atproto.repo.applyWrites#create',
        PUBLICATION_COLLECTION,
        PUBLICATION_RKEY,
      ],
      [
        'com.atproto.repo.applyWrites#create',
        DOCUMENT_COLLECTION,
        '3mwa5ei54c22g',
      ],
    ]
  );
  assert.equal(plan.uploads.length, 1, 'one cover, uploaded once');
  assert.equal(plan.unchanged, 0);
});

test('a record the PDS already holds is left alone, whatever its key order', () => {
  const want = doc('3mwa5ei54c22g', '/writings/a');
  const have = stored(want);
  have.value = Object.fromEntries(Object.entries(have.value).reverse());
  const plan = planSync([want], [have]);
  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.uploads, []);
  assert.equal(plan.unchanged, 1);
});

test('a changed field updates the record in place', () => {
  const have = stored(doc('3mwa5ei54c22g', '/writings/a', 'Old title'));
  const plan = planSync(
    [doc('3mwa5ei54c22g', '/writings/a', 'New title')],
    [have]
  );
  assert.equal(plan.writes.length, 1);
  assert.equal(plan.writes[0].$type, 'com.atproto.repo.applyWrites#update');
});

test('a Bluesky post reference on the PDS survives every sync', () => {
  const want = doc('3mwa5ei54c22g', '/writings/a');
  const have = stored(want);
  have.value.bskyPostRef = ref;
  assert.equal(planSync([want], [have]).unchanged, 1);

  const edited = doc('3mwa5ei54c22g', '/writings/a', 'Edited');
  const [write] = planSync([edited], [have]).writes;
  assert.equal(write.$type, 'com.atproto.repo.applyWrites#update');
  assert.deepEqual(
    write.$type === 'com.atproto.repo.applyWrites#update' &&
      write.value.bskyPostRef,
    ref
  );
});

test('a new key for the same path moves the record and keeps its post', () => {
  const have = stored(doc('3mwa5ei54c22g', '/writings/a'));
  have.value.bskyPostRef = ref;
  const plan = planSync([doc('3mwb22222222a', '/writings/a')], [have]);
  assert.deepEqual(
    plan.writes.map((write) => [write.$type, write.rkey]),
    [
      ['com.atproto.repo.applyWrites#create', '3mwb22222222a'],
      ['com.atproto.repo.applyWrites#delete', '3mwa5ei54c22g'],
    ]
  );
  const [create] = plan.writes;
  assert.deepEqual(
    create.$type === 'com.atproto.repo.applyWrites#create' &&
      create.value.bskyPostRef,
    ref
  );
});

test('only this publication’s documents are ever deleted', () => {
  const gone = stored(doc('3mwa5ei54c22g', '/writings/gone'));
  const leaflet: ExistingRecord = {
    ...stored(doc('3mwa5ei54c2hb', '/someone-else')),
    value: {
      ...gone.value,
      site: 'at://did:plc:x/site.standard.publication/3zzz',
    },
  };
  const otherPublication: ExistingRecord = {
    collection: PUBLICATION_COLLECTION,
    rkey: '3mvzzzzzzzzzz',
    cid: 'bafyrei-other',
    value: {
      $type: 'site.standard.publication',
      name: 'Leaflet',
      url: 'https://x.leaflet.pub',
    },
  };
  const plan = planSync([], [gone, leaflet, otherPublication]);
  assert.deepEqual(
    plan.writes.map((write) => [write.$type, write.rkey]),
    [['com.atproto.repo.applyWrites#delete', '3mwa5ei54c22g']]
  );
});

test('two writings that compute the same key stop the sync', () => {
  assert.throws(
    () =>
      planSync(
        [
          doc('3mwa5ei54c22g', '/writings/a'),
          doc('3mwa5ei54c22g', '/writings/b'),
        ],
        []
      ),
    /\/writings\/a.*\/writings\/b|\/writings\/b.*\/writings\/a/
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-plan.test.mts`
Expected: FAIL with `Cannot find module '@/lib/atproto/plan'`.

- [ ] **Step 3: Implement.** Create `lib/atproto/types.ts`:

```ts
import type { Blob } from '@atcute/lexicons';
import type {
  SiteStandardDocument,
  SiteStandardPublication,
} from '@atcute/standard-site';

import type { Collection } from './config';

/** An image ready to upload, and the blob reference a record carries for it. */
export interface LocalBlob {
  ref: Blob;
  bytes: Uint8Array;
}

export type RecordValue =
  | SiteStandardPublication.Main
  | SiteStandardDocument.Main;

/** A record as the site's content says it should be. */
export interface DesiredRecord {
  collection: Collection;
  rkey: string;
  value: RecordValue;
  /** Blobs `value` references, uploaded only when the record is written. */
  blobs: LocalBlob[];
}

/** A record as the PDS lists it. */
export interface ExistingRecord {
  collection: Collection;
  rkey: string;
  cid: string;
  value: Record<string, unknown>;
}

export type Write =
  | {
      $type: 'com.atproto.repo.applyWrites#create';
      collection: Collection;
      rkey: string;
      value: Record<string, unknown>;
    }
  | {
      $type: 'com.atproto.repo.applyWrites#update';
      collection: Collection;
      rkey: string;
      value: Record<string, unknown>;
    }
  | {
      $type: 'com.atproto.repo.applyWrites#delete';
      collection: Collection;
      rkey: string;
    };

/** The few repo calls the sync makes; tests pass a fake. */
export interface RepoClient {
  listRecords(collection: Collection): Promise<ExistingRecord[]>;
  applyWrites(writes: Write[]): Promise<void>;
  uploadBlob(blob: LocalBlob): Promise<void>;
  close(): Promise<void>;
}
```

Create `lib/atproto/plan.ts`:

```ts
import {
  DOCUMENT_COLLECTION,
  PUBLICATION_COLLECTION,
  publishingIdentity,
} from './config';
import type { DesiredRecord, ExistingRecord, LocalBlob, Write } from './types';

export interface SyncPlan {
  writes: Write[];
  /** Blobs the writes reference, each once. */
  uploads: LocalBlob[];
  unchanged: number;
}

const key = (record: { collection: string; rkey: string }) =>
  `${record.collection}/${record.rkey}`;

/** JSON with object keys sorted, so key order never reads as a change. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))
        )
      : inner
  );
}

/**
 * Records this site manages: its own publication, and documents that
 * name it as their site. Anything else in the repo, such as a Leaflet
 * publication and its posts, is never touched.
 */
function isOurs(record: ExistingRecord): boolean {
  const { publicationRkey, publicationUri } = publishingIdentity();
  return record.collection === PUBLICATION_COLLECTION
    ? record.rkey === publicationRkey
    : record.value.site === publicationUri;
}

/**
 * What it takes to make the repo match the content: create what is
 * missing, update what differs, and delete this site's records that no
 * writing produces any more. A document whose key changed (a new
 * `published` time or slug) is found by path and moved, and a Bluesky
 * post reference on the PDS always carries over.
 */
export function planSync(
  desired: DesiredRecord[],
  existing: ExistingRecord[]
): SyncPlan {
  const seen = new Map<string, string>();
  for (const record of desired) {
    const path = 'path' in record.value ? record.value.path : record.rkey;
    const clash = seen.get(key(record));
    if (clash) {
      throw new Error(
        `${clash} and ${path} compute the same record key ${record.rkey}.`
      );
    }
    seen.set(key(record), String(path));
  }

  const ours = existing.filter(isOurs);
  const byKey = new Map(ours.map((record) => [key(record), record]));
  const byPath = new Map(
    ours
      .filter((record) => record.collection === DOCUMENT_COLLECTION)
      .map((record) => [record.value.path, record])
  );

  const writes: Write[] = [];
  const uploads = new Map<string, LocalBlob>();
  const kept = new Set<string>();
  let unchanged = 0;

  for (const want of desired) {
    const current = byKey.get(key(want));
    const prior =
      current ??
      ('path' in want.value ? byPath.get(want.value.path) : undefined);
    const value: Record<string, unknown> = { ...want.value };
    if (value.bskyPostRef === undefined && prior?.value.bskyPostRef) {
      value.bskyPostRef = prior.value.bskyPostRef;
    }

    if (current) {
      kept.add(key(current));
      if (canonical(current.value) === canonical(value)) {
        unchanged += 1;
        continue;
      }
    }
    writes.push({
      $type: current
        ? 'com.atproto.repo.applyWrites#update'
        : 'com.atproto.repo.applyWrites#create',
      collection: want.collection,
      rkey: want.rkey,
      value,
    });
    for (const blob of want.blobs) uploads.set(blob.ref.ref.$link, blob);
  }

  for (const record of ours) {
    if (kept.has(key(record))) continue;
    writes.push({
      $type: 'com.atproto.repo.applyWrites#delete',
      collection: record.collection,
      rkey: record.rkey,
    });
  }

  return { writes, uploads: [...uploads.values()], unchanged };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-plan.test.mts && pnpm typecheck`
Expected: PASS, 7 tests, with no type errors.

- [ ] **Step 5: Commit.** Paths: `lib/atproto/types.ts lib/atproto/plan.ts tests/unit/atproto-plan.test.mts`. Message: `feat(atproto): Plan the writes that make the repo match the content`.

### Task 7: The live sync, its script, and the post-deploy hook

**Files:**

- Create: `lib/atproto/identity.ts`, `lib/atproto/blobs.ts`, `lib/atproto/client.ts`, `lib/atproto/sync.ts`, `scripts/atproto-sync.mts`
- Modify: `package.json`, `pnpm-lock.yaml` (`pnpm add @atcute/identity@^2.0.2 @atcute/identity-resolver@^2.0.2`, and the `atproto:sync` script), `app/api/indieweb/notify/route.ts`
- Modify: `.env.example`, `docs/indieweb/README.md` (Scripts and Environment variables tables, and the firewall note at about line 586), `docs/atproto.md` (a sync section)
- Test: `tests/unit/atproto-sync.test.mts`

**Interfaces:**

- Consumes: `planSync` (Task 6); `publicationRecord`, `documentRecord`, `documentPath` and `DocumentSource` (Task 4); `documentRkey`, `PUBLICATION_URI`, `publishingIdentity` and `appPassword` (Task 3); the types (Task 6).
- Produces:
  - `resolvePds(did: Did): Promise<string>`, from the DID document
  - `localBlob(bytes: Uint8Array, mimeType: string): Promise<LocalBlob>`
  - `fetchImageBlob(url: string): Promise<LocalBlob | null>`
  - `createRepoClient(password: string): Promise<RepoClient>`
  - `syncAtproto(options?: SyncOptions): Promise<SyncReport>`
  - `SyncReport`, one of:
    - `{ status: 'skipped'; reason: string }`
    - `{ status: 'planned' | 'synced'; created: number; updated: number; deleted: number; unchanged: number; writes: { action: 'create' | 'update' | 'delete'; uri: string }[] }`

- [ ] **Step 1: Write the failing test.** Create `tests/unit/atproto-sync.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { localBlob } from '@/lib/atproto/blobs';
import {
  DOCUMENT_COLLECTION,
  PUBLICATION_COLLECTION,
} from '@/lib/atproto/config';
import type { DocumentSource } from '@/lib/atproto/records';
import { syncAtproto } from '@/lib/atproto/sync';
import type {
  ExistingRecord,
  LocalBlob,
  RepoClient,
  Write,
} from '@/lib/atproto/types';

function fakeRepo() {
  const records: ExistingRecord[] = [];
  const log = { writes: [] as Write[], uploads: [] as LocalBlob[] };
  const client: RepoClient = {
    async listRecords(collection) {
      return records.filter((record) => record.collection === collection);
    },
    async applyWrites(writes) {
      log.writes.push(...writes);
      for (const write of writes) {
        const at = records.findIndex(
          (r) => r.collection === write.collection && r.rkey === write.rkey
        );
        if (at >= 0) records.splice(at, 1);
        if (write.$type !== 'com.atproto.repo.applyWrites#delete') {
          records.push({
            collection: write.collection,
            rkey: write.rkey,
            cid: 'bafyrei-fake',
            value: JSON.parse(JSON.stringify(write.value)),
          });
        }
      }
    },
    async uploadBlob(blob) {
      log.uploads.push(blob);
    },
    async close() {},
  };
  return { client, records, log };
}

const note: DocumentSource = {
  slug: 'a-note',
  title: 'A note about the site.',
  description: 'A note about the site.',
  published: new Date('2026-10-01T12:00:00Z'),
  lastUpdated: new Date('2026-10-01T12:00:00Z'),
  tags: [],
  body: 'A note about the site.',
};

const png = async () =>
  localBlob(new TextEncoder().encode('hello'), 'image/png');

test('a blob reference is the raw CID of its bytes', async () => {
  const blob = await png();
  assert.deepEqual(blob.ref, {
    $type: 'blob',
    ref: {
      $link: 'bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq',
    },
    mimeType: 'image/png',
    size: 5,
  });
});

test('without an app password the sync skips', async () => {
  const saved = process.env.ATPROTO_APP_PASSWORD;
  delete process.env.ATPROTO_APP_PASSWORD;
  try {
    const report = await syncAtproto({ writings: [note], fetchImage: png });
    assert.equal(report.status, 'skipped');
  } finally {
    if (saved !== undefined) process.env.ATPROTO_APP_PASSWORD = saved;
  }
});

test('a dry run plans without writing', async () => {
  const { client, log } = fakeRepo();
  const report = await syncAtproto({
    client,
    dryRun: true,
    writings: [note],
    fetchImage: png,
  });
  assert.equal(report.status, 'planned');
  assert.equal(report.status !== 'skipped' && report.created, 2);
  assert.deepEqual(log.writes, []);
  assert.deepEqual(log.uploads, []);
});

test('a sync publishes once and then has nothing to do', async () => {
  const { client, records, log } = fakeRepo();
  const first = await syncAtproto({
    client,
    writings: [note],
    fetchImage: png,
  });
  assert.equal(first.status, 'synced');
  assert.deepEqual(records.map((record) => record.collection).sort(), [
    DOCUMENT_COLLECTION,
    PUBLICATION_COLLECTION,
  ]);
  assert.equal(log.uploads.length, 1, 'icon and cover share bytes, one upload');

  const second = await syncAtproto({
    client,
    writings: [note],
    fetchImage: png,
  });
  assert.equal(second.status !== 'skipped' && second.unchanged, 2);
  assert.equal(log.writes.length, 2, 'no writes the second time');
});

test('unpublishing a writing deletes its record', async () => {
  const { client, records } = fakeRepo();
  await syncAtproto({ client, writings: [note], fetchImage: png });
  const report = await syncAtproto({ client, writings: [], fetchImage: png });
  assert.equal(report.status !== 'skipped' && report.deleted, 1);
  assert.deepEqual(
    records.map((record) => record.collection),
    [PUBLICATION_COLLECTION]
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-sync.test.mts`
Expected: FAIL with `Cannot find module '@/lib/atproto/blobs'`.

- [ ] **Step 3: Implement the blobs and the client.** Create `lib/atproto/blobs.ts`:

```ts
import * as CID from '@atcute/cid';

import type { LocalBlob } from './types';

/** The lexicons' limit for icons and covers, and Bluesky's for thumbs. */
export const MAX_BLOB_BYTES = 1_000_000;
const RASTER = /^image\/(png|jpeg|webp|gif)$/;

/**
 * The blob reference a record carries for these bytes, computed locally:
 * a raw-codec CID, the same one the PDS returns on upload. Comparing
 * references lets the sync skip uploads for unchanged records.
 */
export async function localBlob(
  bytes: Uint8Array,
  mimeType: string
): Promise<LocalBlob> {
  const cid = await CID.create(0x55, bytes);
  return {
    bytes,
    ref: {
      $type: 'blob',
      ref: { $link: CID.toString(cid) },
      mimeType,
      size: bytes.byteLength,
    },
  };
}

/**
 * An image from the live site, or null when it is missing, not a raster
 * image, or over the limit. A record without a cover is still valid, so
 * a failed fetch never fails the sync.
 */
export async function fetchImageBlob(url: string): Promise<LocalBlob | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif' },
    });
    const mimeType =
      response.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!response.ok || !RASTER.test(mimeType)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BLOB_BYTES) {
      console.warn(`${url} is ${bytes.byteLength} bytes; skipping its blob.`);
      return null;
    }
    return localBlob(bytes, mimeType);
  } catch (error) {
    console.warn(`Could not fetch ${url} for a blob:`, error);
    return null;
  }
}
```

Run `pnpm add @atcute/identity@^2.0.2 @atcute/identity-resolver@^2.0.2`, then create `lib/atproto/identity.ts`:

```ts
import { getPdsEndpoint } from '@atcute/identity';
import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver';
import type { Did } from '@atcute/lexicons';

/** Calls the global fetch at request time, so tests can stub it. */
const fetchNow: typeof fetch = (input, init) => fetch(input, init);

/**
 * DID documents, resolved by the identity library's own did:plc and
 * did:web methods. Where a repo lives is read from its DID document, never
 * written down, so a PDS move needs no change here.
 */
const resolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver({ fetch: fetchNow }),
    web: new WebDidDocumentResolver({ fetch: fetchNow }),
  },
});

/** The PDS that hosts a repo. */
export async function resolvePds(did: Did): Promise<string> {
  const document = await resolver.resolve(did as Did<'plc' | 'web'>);
  const pds = getPdsEndpoint(document);
  if (!pds) throw new Error(`${did} names no PDS.`);
  return pds;
}
```

Create `lib/atproto/client.ts`:

```ts
import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
import { PasswordSession } from '@atcute/password-session';

import { publishingIdentity } from './config';
import { resolvePds } from './identity';
import type { RepoClient } from './types';

/** The PDS's limit on operations in one applyWrites call. */
const MAX_WRITES = 200;

/**
 * A repo client signed in with the site's app password, straight at the
 * PDS the DID document names.
 */
export async function createRepoClient(password: string): Promise<RepoClient> {
  const { did } = publishingIdentity();
  const session = await PasswordSession.login({
    service: await resolvePds(did),
    identifier: did,
    password,
  });
  const rpc = new Client({ handler: session });

  return {
    async listRecords(collection) {
      const records = [];
      let cursor: string | undefined;
      do {
        const page = await ok(
          rpc.get('com.atproto.repo.listRecords', {
            params: { repo: did, collection, limit: 100, cursor },
          })
        );
        for (const record of page.records) {
          records.push({
            collection,
            rkey: record.uri.slice(record.uri.lastIndexOf('/') + 1),
            cid: record.cid,
            value: record.value as Record<string, unknown>,
          });
        }
        cursor = page.cursor;
      } while (cursor);
      return records;
    },
    async applyWrites(writes) {
      for (let start = 0; start < writes.length; start += MAX_WRITES) {
        await ok(
          rpc.post('com.atproto.repo.applyWrites', {
            input: {
              repo: did,
              writes: writes.slice(start, start + MAX_WRITES),
            },
          })
        );
      }
    },
    async uploadBlob({ bytes, ref }) {
      await ok(
        rpc.post('com.atproto.repo.uploadBlob', {
          input: bytes,
          headers: { 'content-type': ref.mimeType },
        })
      );
    },
    close: () => session.logout(),
  };
}
```

If `pnpm typecheck` rejects the `writes` array against the generated `applyWrites` input type, cast at the call (`writes.slice(…) as never`) and leave a comment saying why. `Write` mirrors that schema field for field.

- [ ] **Step 4: Implement the sync.** Create `lib/atproto/sync.ts`:

```ts
import { absoluteUrl, site } from '@/lib/site';

import { fetchImageBlob } from './blobs';
import { createRepoClient } from './client';
import {
  DOCUMENT_COLLECTION,
  PUBLICATION_COLLECTION,
  PUBLICATION_URI,
  appPassword,
  publishingIdentity,
} from './config';
import { documentRkey } from './keys';
import { planSync } from './plan';
import {
  type DocumentSource,
  documentPath,
  documentRecord,
  publicationRecord,
} from './records';
import type { DesiredRecord, LocalBlob, RepoClient } from './types';

export type SyncReport =
  | { status: 'skipped'; reason: string }
  | {
      status: 'planned' | 'synced';
      created: number;
      updated: number;
      deleted: number;
      unchanged: number;
      writes: { action: 'create' | 'update' | 'delete'; uri: string }[];
    };

export interface SyncOptions {
  /** Plan and report without uploading or writing anything. */
  dryRun?: boolean;
  /** A repo client; tests pass a fake. Defaults to one signed in with ATPROTO_APP_PASSWORD. */
  client?: RepoClient;
  /** Published writings; defaults to reading content/writings. */
  writings?: DocumentSource[];
  fetchImage?: (url: string) => Promise<LocalBlob | null>;
}

/** Every published writing, read without the Next.js cache. */
async function publishedWritings(): Promise<DocumentSource[]> {
  const { getWritingSlugs, loadWriting } = await import('@/lib/writings');
  const sources: DocumentSource[] = [];
  for (const slug of await getWritingSlugs()) {
    const { writing, content } = await loadWriting(slug);
    if (writing.draft) continue;
    sources.push({
      slug,
      title: writing.title,
      description: writing.description,
      published: writing.published,
      lastUpdated: writing.lastUpdated,
      tags: writing.tags,
      body: content,
      image: writing.featuredImage,
    });
  }
  return sources;
}

async function desiredRecords(
  writings: DocumentSource[],
  fetchImage: (url: string) => Promise<LocalBlob | null>
): Promise<DesiredRecord[]> {
  const icon = await fetchImage(absoluteUrl(site.author.photo));
  const records: DesiredRecord[] = [
    {
      collection: PUBLICATION_COLLECTION,
      rkey: publishingIdentity().publicationRkey,
      value: publicationRecord(icon?.ref),
      blobs: icon ? [icon] : [],
    },
  ];
  for (const writing of writings) {
    const path = documentPath(writing.slug);
    const cover = await fetchImage(
      absoluteUrl(writing.image ?? `${path}/opengraph-image`)
    );
    records.push({
      collection: DOCUMENT_COLLECTION,
      rkey: documentRkey(path, writing.published),
      value: documentRecord(writing, { coverImage: cover?.ref }),
      blobs: cover ? [cover] : [],
    });
  }
  return records;
}

/**
 * Make the repo match the published content: the publication record and
 * one document per writing. Runs after a production deploy, once the
 * pages that name these records are live (app/api/indieweb/notify).
 */
export async function syncAtproto(
  options: SyncOptions = {}
): Promise<SyncReport> {
  // Records are written wherever the password is set, which is Production
  // only: a preview or acceptance deployment has none and never writes.
  if (!PUBLICATION_URI) {
    return {
      status: 'skipped',
      reason: 'NEXT_PUBLIC_ATPROTO_DID or ATPROTO_PUBLICATION_RKEY is not set',
    };
  }
  let client = options.client;
  if (!client) {
    const password = appPassword();
    if (!password) {
      return { status: 'skipped', reason: 'ATPROTO_APP_PASSWORD is not set' };
    }
    client = await createRepoClient(password);
  }
  const { did } = publishingIdentity();

  try {
    const writings = options.writings ?? (await publishedWritings());
    const desired = await desiredRecords(
      writings,
      options.fetchImage ?? fetchImageBlob
    );
    const existing = [
      ...(await client.listRecords(PUBLICATION_COLLECTION)),
      ...(await client.listRecords(DOCUMENT_COLLECTION)),
    ];
    const plan = planSync(desired, existing);

    if (!options.dryRun) {
      for (const blob of plan.uploads) await client.uploadBlob(blob);
      if (plan.writes.length > 0) await client.applyWrites(plan.writes);
    }

    const writes = plan.writes.map((write) => ({
      action: write.$type.slice(write.$type.indexOf('#') + 1) as
        | 'create'
        | 'update'
        | 'delete',
      uri: `at://${did}/${write.collection}/${write.rkey}`,
    }));
    const count = (action: string) =>
      writes.filter((write) => write.action === action).length;
    return {
      status: options.dryRun ? 'planned' : 'synced',
      created: count('create'),
      updated: count('update'),
      deleted: count('delete'),
      unchanged: plan.unchanged,
      writes,
    };
  } finally {
    // Sign out only of a session this call opened.
    if (!options.client) await client.close();
  }
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/atproto-sync.test.mts && pnpm typecheck`
Expected: PASS, 6 tests, with no type errors.

- [ ] **Step 6: Add the script and the hook.** Create `scripts/atproto-sync.mts`:

```ts
#!/usr/bin/env node
// Dry run by default: prints what the sync would write. Pass --write to
// write it. Needs ATPROTO_APP_PASSWORD, read from .env.atproto.local (vercel
// env pull .env.atproto.local --environment=production).
import { syncAtproto } from '../lib/atproto/sync';

const report = await syncAtproto({ dryRun: !process.argv.includes('--write') });
console.log(JSON.stringify(report, null, 2));
if (report.status === 'skipped') process.exitCode = 1;
```

In `package.json` `scripts`, after `webmentions:backfill-authors`, add:

```json
    "atproto:sync": "tsx --env-file-if-exists=.env.atproto.local scripts/atproto-sync.mts",
```

In `app/api/indieweb/notify/route.ts`, import `syncAtproto` from `@/lib/atproto/sync`, keep `export const maxDuration = 60;` (the Hobby cap while Fluid compute is off; a larger value fails the deploy), and replace the `try` block's body with:

```ts
const topics = await publishedTopicPaths();
const websub = await pingWebSubHub(topics.map((path) => absoluteUrl(path)));
const webmentions = await sendChangedWebmentions();
// Last, and on its own, so a PDS outage never holds back WebSub or
// webmentions; a failure still fails the workflow run.
const atproto = await syncAtproto().catch((error: unknown) => {
  console.error('AT Protocol sync failed:', error);
  return { status: 'failed' as const };
});
return Response.json(
  { websub, webmentions, atproto },
  {
    status:
      websub.ok && webmentions.failed === 0 && atproto.status !== 'failed'
        ? 200
        : 502,
  }
);
```

Run: `pnpm exec tsx --env-file=tests/unit/test.env --test tests/unit/indieweb-notify.test.mts`
Expected: PASS. Those tests cover authentication only.

- [ ] **Step 7: Write the docs.** In `.env.example`, append these to the `# --- AT Protocol ---` section the identity fix added:

```bash
# The standard.site publication's record key: a TID generated once (see
# docs/atproto.md) and never changed, because every page names the record by
# it. Empty leaves out the publication, its <link> tags, and the sync.
ATPROTO_PUBLICATION_RKEY=
# App password for the account behind NEXT_PUBLIC_ATPROTO_DID (Bluesky
# Settings > Privacy and security > App passwords). The post-deploy sync writes
# the standard.site records with it. Set it on Production only. Empty skips the
# sync. Never commit a real value.
ATPROTO_APP_PASSWORD=
```

In `docs/indieweb/README.md`, make three changes:

- Add a Scripts row: `` `pnpm atproto:sync` `` | `Prints the standard.site writes a sync would make; --write makes them. Needs ATPROTO_APP_PASSWORD; see atproto.md.`
- Add two Environment variables rows: `` `ATPROTO_PUBLICATION_RKEY` `` | `the standard.site publication: its record, <link> tags, and well-known route` | `unset, all off`, and `` `ATPROTO_APP_PASSWORD` `` | `standard.site sync after each production deploy` | `unset, sync skipped`.
- In the firewall paragraph at about line 586, add `/.well-known/site.standard.publication`, `/.well-known/atproto-did`, `/writings/*/opengraph-image` and `/brand/social/*` to the paths no challenge may cover.

Then run `pnpm exec prettier --write docs/indieweb/README.md`.

Append to `docs/atproto.md`:

```markdown
## Sync

After every push to `main`, `.github/workflows/indieweb-publish.yml` waits for
the deployment and calls `/api/indieweb/notify`. The handler pings WebSub,
sends webmentions, and then runs `syncAtproto()` (`lib/atproto/sync.ts`):

1. It reads every published writing with the uncached loaders.
2. It builds the publication record and one document per writing. Icons and
   covers are fetched from the live site: `featuredImage`, or the generated
   `opengraph-image`. An image over 1,000,000 bytes is left out.
3. It lists this site's records on the PDS and plans the difference
   (`lib/atproto/plan.ts`). It never touches records whose `site` is another
   publication.
4. It uploads the blobs that changed records need, then applies the writes in
   one `applyWrites` call per 200 operations.

The sync is skipped when the DID, the publication key, or
`ATPROTO_APP_PASSWORD` is empty. The password is set on Production only, so a
preview deployment never writes. It signs in at the PDS that the DID document
names (`lib/atproto/identity.ts`).

To see what the next sync would do, run
`vercel env pull .env.atproto.local --environment=production`, then
`pnpm atproto:sync`. Run `pnpm atproto:sync --write` to apply it by hand. The
file holds production values only and is gitignored, so `next dev` never
loads them from `.env.local`. A password stored as a Sensitive variable cannot
be pulled; add it to `.env.atproto.local` by hand.

## Checking it

- `https://pdsls.dev/at://<NEXT_PUBLIC_ATPROTO_DID>` shows the records.
- `https://site-validator.fly.dev/` checks a writing's URL end to end: the
  `<link>` tag, the record, the publication, and the well-known route.
- Paste a writing's URL into the Bluesky composer. The card should show the
  publication's icon and name.
```

- [ ] **Step 8: Run the full checks**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: everything passes.

- [ ] **Step 9: Commit.** Paths: `pnpm-lock.yaml lib/atproto/identity.ts lib/atproto/blobs.ts lib/atproto/client.ts lib/atproto/sync.ts scripts/atproto-sync.mts package.json app/api/indieweb/notify/route.ts .env.example docs/indieweb/README.md docs/atproto.md tests/unit/atproto-sync.test.mts`. Message: `feat(atproto): Sync standard.site records after each production deploy`.

- [ ] **Step 10: Open PR B** (Tasks 3 to 7). Its title is `feat(atproto): Publish writings as standard.site documents`.

---

## Verification after PR B merges (needs Phase 0)

1. **The well-known route.**
   `curl -s https://willie.page/.well-known/site.standard.publication`
   should print `at://<NEXT_PUBLIC_ATPROTO_DID>/site.standard.publication/<ATPROTO_PUBLICATION_RKEY>`.
   Keep it to one request; the Vercel checkpoint starts challenging after
   about ten.
2. **The workflow run.** The `IndieWeb publish notifications` run for the
   merge commit prints `"atproto":{"status":"synced","created":1,…}`. While
   every writing is a draft, that is the publication only.
3. **The publication on the PDS.** pdsls.dev shows
   `site.standard.publication/<ATPROTO_PUBLICATION_RKEY>` with the icon and theme colors.
4. **The first published writing.** After it merges:
   1. The workflow reports `created` for its document.
   2. site-validator.fly.dev passes for its URL.
   3. The Bluesky composer card shows the publication.
   4. Within minutes, a reader such as read.pckt.blog or docs.surf lists it.
5. **Idempotence.** Re-running the workflow, or running
   `pnpm atproto:sync` locally, reports only `unchanged`.

## Next plans

- **Phase 3: Bluesky posting and comments.** See
  [2026-10-02-bluesky-posse.md](./2026-10-02-bluesky-posse.md). It builds on
  this plan: `bskyPostRef` survives every sync (`planSync`), and
  `DocumentExtras.bskyPostRef` exists.
- **Phase 4: subscribe and recommend.** See the spec.
