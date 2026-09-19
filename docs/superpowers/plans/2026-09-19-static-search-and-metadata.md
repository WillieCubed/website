# Site-wide Search and Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Pagefind-backed ⌘K search over the whole site, widen the existing server-rendered `/search` to the same content, and ship JSON-LD, Open Graph, robots, and sitemap improvements.

**Architecture:** One collector (`lib/search/collect.ts`) turns writings, initiatives, initiative parts, and static pages into `SearchableItem`s. The prebuild script feeds those to both the existing JSON index (server `/search`) and a Pagefind index in `public/pagefind/` (client ⌘K modal). Metadata work is separate: pure builders in `lib/seo/` and an extended `pageMetadata()` in `lib/site.ts`, wired into the pages.

**Tech Stack:** Next.js 16 (App Router, Cache Components), React 19, TypeScript, pnpm 11, Pagefind (Node API + Component UI web components), `tsx --test` unit tests.

Spec: `docs/superpowers/specs/2026-09-18-static-search-and-metadata-design.md`.

## Global Constraints

- Canonical origin is `https://willie.page`, taken from `site.origin` / `absoluteUrl()` in `lib/site.ts`. Never hardcode a hostname.
- Drafts never appear in the search index, the sitemap, or structured data. The prebuild runs under `tsx` where `NODE_ENV !== 'production'`, so draft filtering must be explicit.
- `search_index.slug` is `UNIQUE` across all content types and `published_at` is `NOT NULL`. Items without a date use `UNDATED`.
- `/search`, `/api/search`, the Postgres backend, and the reindex route keep their contracts.
- The ⌘K modal is not mounted in hiatus mode.
- AI-crawler policy is unchanged: block training crawlers from `/writings/` only. Link-preview bots (`Slackbot`, `LinkedInBot`, `facebookexternalhit`, `Twitterbot`) are never disallowed.
- Out of scope: metadata audit test, IndexNow, `llms-full.txt`, `SearchAction`, series OG images, image sitemap entries.
- Tests: `pnpm test` runs `tsx --test tests/unit/*.test.mts`. `.mts` tests are not typechecked. `pnpm typecheck` runs `tsc --noEmit`. Baseline before any change: 22 tests pass, typecheck clean.
- Formatting: run `pnpm exec prettier --write <files>` and `pnpm exec eslint <ts/tsx files>` before every commit. The `.husky/pre-commit` hook is not executable, so lint-staged does not run on commit.
- Prettier config: single quotes, `trailingComma: 'es5'`, 80 columns, imports grouped `@/components` → `@/lib` → relative.
- Replace/with snippets are fragments. Prettier normalized their indentation when this plan was formatted, so match the target text by content rather than leading whitespace, keep the file's own indentation, and run prettier afterwards.
- Commits use `type(scope): Subject` (`docs/commits.md`). Scopes in use: `indieweb` (search), `landing`, `writings`, `initiatives`, `docs`; omit the scope for site-wide metadata.

### Commit recipe

Every commit step uses one shell invocation that writes the message file, resets the index, stages exactly the listed paths, and commits (never `-m`, never stage in a separate call):

```bash
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
<type(scope): Subject>

<one or two lines of body>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add <path1> <path2> && git commit -F "$MSG"
```

## Execution order

Run Tasks 1 to 12 in order. Part 1 (Tasks 1 to 4) and Part 2 (Tasks 5 to 11) touch different files except `app/layout.tsx` (Tasks 4 and 7), so do not run them in parallel.

## Deviations from the spec

The plan refines four spec details. Task 12 edits the spec so it matches.

1. `STATIC_PAGES` moves to a new `lib/entities/pages.ts` (re-imported by `registry.ts`) instead of being exported from `registry.ts`. The registry module holds `'use cache'` functions; a pure list should not live beside them.
2. Pagefind theming lives in `components/search/search.css`, not `app/globals.css`.
3. The sitemap is built by a pure `lib/seo/sitemap.ts` so it can be unit tested. `app/sitemap.ts` only loads data.
4. `SiteSearch` shows a date only for writings, and `Person.worksFor` carries the three `Organization`s inline (no separate Organization nodes), so every page's JSON-LD graph is self-contained.

## File structure

| File                                | Responsibility                                                              |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `lib/search/types.ts`               | `SearchableItem` (adds `path`), `UNDATED`, `SearchContentType`              |
| `lib/search/collect.ts`             | Pure mappers plus `collectSearchDocuments()`                                |
| `lib/search/index.ts`               | `generateSearchIndex()` delegates to the collector                          |
| `lib/search/server.ts`              | `selectSearchable()`, widened `searchContent()`                             |
| `lib/search/pagefind.ts`            | `toPagefindRecord()`, `buildPagefindIndex()`                                |
| `lib/entities/pages.ts`             | `STATIC_PAGES`, shared by hover cards and search                            |
| `lib/initiatives/index.ts`          | `loadAllInitiatives()`, an uncached loader for build scripts                |
| `lib/initiatives/viewport.ts`       | Theme-colour lookup shared by the initiative and part pages                 |
| `components/search/SearchModal.tsx` | Client component: mounts `<pagefind-modal>`, loads the Component UI at idle |
| `components/search/search.css`      | `--pf-*` theme variables and trigger placeholder sizing                     |
| `components/search/pagefind.d.ts`   | JSX types for the Pagefind custom elements                                  |
| `lib/seo/jsonld.ts`                 | Pure JSON-LD builders and `serializeJsonLd()`                               |
| `components/seo/JsonLd.tsx`         | Renders one `<script type="application/ld+json">`                           |
| `lib/seo/sitemap.ts`                | Pure `buildSitemap()`                                                       |
| `lib/site.ts`                       | `site.ventures`, extended `pageMetadata()`                                  |

---

### Task 1: Search item model and shared collector

**Files:**

- Modify: `lib/search/types.ts`
- Create: `lib/entities/pages.ts`
- Modify: `lib/entities/registry.ts`
- Modify: `lib/initiatives/index.ts`
- Create: `lib/search/collect.ts` (copied from `lib/search/index.ts`, then edited)
- Modify: `lib/search/index.ts`, `lib/search/postgres.ts`, `lib/search/server.ts`
- Modify: `tests/unit/search-rank.test.mts`
- Test: `tests/unit/search-collect.test.mts`

**Interfaces:**

- Produces (used by Tasks 2, 3, 4):
  - `UNDATED: string` and `SearchableItem` with `path: string` and `type: 'writing' | 'initiative' | 'page' | 'project'` from `@/lib/search/types`
  - `collectSearchDocuments(): Promise<SearchableItem[]>`, `writingToItem(writing: WritingData, content: string): SearchableItem`, `initiativeToItems(initiative: Initiative): SearchableItem[]`, `pageToItem(page: EntityCard): SearchableItem` from `@/lib/search/collect`
  - `loadAllInitiatives(options?: { includeDrafts?: boolean; now?: Date }): Initiative[]` from `@/lib/initiatives`
  - `STATIC_PAGES: EntityCard[]` from `@/lib/entities/pages`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/search-collect.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import type { EntityCard } from '@/lib/entities/types';
import {
  type Initiative,
  type Part,
  loadAllInitiatives,
} from '@/lib/initiatives';
import {
  collectSearchDocuments,
  initiativeToItems,
  pageToItem,
  writingToItem,
} from '@/lib/search/collect';
import { UNDATED } from '@/lib/search/types';
import { type WritingData, getWritingSlugs, loadWriting } from '@/lib/writings';

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    number: 1,
    title: 'Las Vegas',
    tagline: 'Where the tour starts.',
    starts: new Date(2026, 8, 18),
    ends: new Date(2026, 8, 20),
    places: [{ name: 'Las Vegas', lat: 36.17, lng: -115.14 }],
    milestones: [],
    draft: false,
    slug: 'part-1',
    initiative: 'fall-tour-2026',
    status: 'planned',
    content: 'We leave **early** from [home](/).',
    ...overrides,
  };
}

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    title: 'Fall Tour 2026',
    tagline: 'A tour.',
    description: 'A four-part tour.',
    kind: 'campaign',
    partLabel: 'Part',
    links: [],
    syndication: [],
    draft: false,
    slug: 'fall-tour-2026',
    status: 'planned',
    content: 'The plan, in **bold**.',
    parts: [makePart()],
    href: '/initiatives/fall-tour-2026',
    starts: new Date(2026, 8, 18),
    ...overrides,
  };
}

test('initiativeToItems emits the initiative and each part with unique keys', () => {
  const items = initiativeToItems(
    makeInitiative({
      parts: [
        makePart(),
        makePart({ number: 2, slug: 'part-2', title: 'Reno' }),
      ],
    })
  );
  assert.deepEqual(
    items.map((item) => item.slug),
    [
      'initiatives/fall-tour-2026',
      'initiatives/fall-tour-2026/part-1',
      'initiatives/fall-tour-2026/part-2',
    ]
  );
  assert.deepEqual(
    items.map((item) => item.path),
    [
      '/initiatives/fall-tour-2026',
      '/initiatives/fall-tour-2026/part-1',
      '/initiatives/fall-tour-2026/part-2',
    ]
  );
  assert.ok(items.every((item) => item.type === 'initiative'));
});

test('initiativeToItems skips a draft initiative and draft parts', () => {
  assert.deepEqual(initiativeToItems(makeInitiative({ draft: true })), []);
  const items = initiativeToItems(
    makeInitiative({
      parts: [makePart(), makePart({ number: 2, slug: 'part-2', draft: true })],
    })
  );
  assert.deepEqual(
    items.map((item) => item.slug),
    ['initiatives/fall-tour-2026', 'initiatives/fall-tour-2026/part-1']
  );
});

test('part items are titled like the part page and searchable by place', () => {
  const [, part] = initiativeToItems(makeInitiative());
  assert.equal(part.title, 'Part 1: Las Vegas');
  assert.ok(part.content.includes('Las Vegas'));
  assert.ok(part.content.includes('early'));
  assert.ok(!part.content.includes('**'));
  assert.ok(!part.content.includes('](/)'));
});

test('undated initiatives use UNDATED and dated ones use their start', () => {
  const [undated] = initiativeToItems(makeInitiative({ starts: undefined }));
  assert.equal(undated.published, UNDATED);
  const [dated] = initiativeToItems(makeInitiative());
  assert.equal(dated.published, new Date(2026, 8, 18).toISOString());
});

test('pageToItem keys pages by href and leaves them undated', () => {
  const home: EntityCard = {
    href: '/',
    kind: 'page',
    title: 'Willie Chalmers III',
    description: 'Builds software.',
  };
  const writings: EntityCard = {
    ...home,
    href: '/writings',
    title: 'Writings',
  };
  assert.equal(pageToItem(home).slug, 'pages/home');
  assert.equal(pageToItem(home).path, '/');
  assert.equal(pageToItem(writings).slug, 'pages/writings');
  assert.equal(pageToItem(writings).published, UNDATED);
  assert.equal(pageToItem(writings).type, 'page');
});

test('writingToItem maps a writing to a rooted, dated item', () => {
  const writing: WritingData = {
    slug: 'hello',
    title: 'Hello',
    description: 'A note.',
    published: new Date('2026-01-04T00:00:00Z'),
    lastUpdated: new Date('2026-01-04T00:00:00Z'),
    tags: ['personal'],
    draft: false,
    readingTime: 1,
    postType: 'article',
  };
  const item = writingToItem(writing, 'Some **bold** words.');
  assert.equal(item.slug, 'hello');
  assert.equal(item.path, '/writings/hello');
  assert.equal(item.published, '2026-01-04T00:00:00.000Z');
  assert.equal(item.content, 'Some bold words.');
  assert.equal(item.type, 'writing');
});

test('collectSearchDocuments never includes a draft', async () => {
  const keys = new Set(
    (await collectSearchDocuments()).map((item) => item.slug)
  );

  for (const slug of await getWritingSlugs()) {
    const { writing } = await loadWriting(slug);
    if (writing.draft) {
      assert.ok(!keys.has(slug), `draft writing ${slug} was indexed`);
    }
  }
  for (const initiative of loadAllInitiatives({ includeDrafts: true })) {
    const base = `initiatives/${initiative.slug}`;
    if (initiative.draft) {
      const leaked = [...keys].filter(
        (key) => key === base || key.startsWith(`${base}/`)
      );
      assert.deepEqual(leaked, [], `draft initiative ${base} was indexed`);
      continue;
    }
    for (const part of initiative.parts) {
      if (part.draft) {
        assert.ok(!keys.has(`${base}/${part.slug}`), `draft part ${part.slug}`);
      }
    }
  }
});

test('collectSearchDocuments returns unique keys, rooted paths, and the static pages', async () => {
  const items = await collectSearchDocuments();
  assert.equal(new Set(items.map((item) => item.slug)).size, items.length);
  assert.ok(items.every((item) => item.path.startsWith('/')));
  for (const key of ['pages/home', 'pages/writings', 'pages/initiatives']) {
    assert.ok(
      items.some((item) => item.slug === key),
      `missing ${key}`
    );
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test tests/unit/search-collect.test.mts`
Expected: FAIL. The `@/lib/search/collect` module cannot be found.

- [ ] **Step 3: Update the item model**

In `lib/search/types.ts`, replace the `SearchableItem` type:

```ts
export type SearchableItem = {
  slug: string;
  title: string;
  description: string;
  /** Plain text content, stripped of MDX syntax */
  content: string;
  tags: string[];
  /** ISO date string */
  published: string;
  type: 'writing' | 'project';
};
```

with:

```ts
/**
 * Stands in for a date on items that have none. It satisfies the
 * `published_at NOT NULL` column and sorts undated items last.
 */
export const UNDATED = '1970-01-01T00:00:00.000Z';

export type SearchableItem = {
  /**
   * Unique across every type: the Postgres `slug` column is UNIQUE. Writings
   * keep their bare slug; other types are prefixed (`initiatives/twd`,
   * `pages/home`).
   */
  slug: string;
  /** Site-relative URL the result opens. */
  path: string;
  title: string;
  description: string;
  /** Plain text content, stripped of MDX syntax */
  content: string;
  tags: string[];
  /** ISO date string, or UNDATED */
  published: string;
  type: 'writing' | 'initiative' | 'page' | 'project';
};
```

- [ ] **Step 4: Share the static page list**

Create `lib/entities/pages.ts`:

```ts
import { site } from '@/lib/site';

import type { EntityCard } from './types';

/**
 * Pages that are not generated from content but still deserve a card.
 * Keep the descriptions in sync with each page's metadata. Hover cards and
 * site search both read this list.
 */
export const STATIC_PAGES: EntityCard[] = [
  {
    href: '/',
    kind: 'page',
    title: site.name,
    description: site.shortDescription,
  },
  {
    href: '/initiatives',
    kind: 'page',
    title: 'Initiatives',
    description:
      'The campaigns, series, and projects Willie is running right now.',
  },
  {
    href: '/writings',
    kind: 'page',
    title: 'Writings',
    description: 'Articles, notes, and replies from Willie.',
  },
];
```

In `lib/entities/registry.ts`, replace:

```ts
import type { EntityCard } from './types';

export type { EntityCard };
```

with:

```ts
import { STATIC_PAGES } from './pages';
import type { EntityCard } from './types';

export type { EntityCard };
```

Then delete the local list. Replace this whole block with nothing:

```ts
/**
 * Pages that are not generated from content but still deserve a card.
 * Keep the descriptions in sync with each page's metadata.
 */
const STATIC_PAGES: EntityCard[] = [
  {
    href: '/',
    kind: 'page',
    title: site.name,
    description: site.shortDescription,
  },
  {
    href: '/initiatives',
    kind: 'page',
    title: 'Initiatives',
    description:
      'The campaigns, series, and projects Willie is running right now.',
  },
  {
    href: '/writings',
    kind: 'page',
    title: 'Writings',
    description: 'Articles, notes, and replies from Willie.',
  },
];
```

`site` and `formatDate` stay imported: `range()` still uses `site.timeZone`.

- [ ] **Step 5: Add an uncached initiative loader for build scripts**

In `lib/initiatives/index.ts`, insert this immediately above the line `/** Drafts render in development so they can be previewed, never in production. */`:

```ts
/**
 * Every initiative read straight from disk with no Next.js cache involved.
 *
 * Build scripts run under plain Node, where `cacheLife()` throws, so they
 * call this instead of {@link getInitiatives}. Drafts are excluded unless
 * `includeDrafts` is set, and NODE_ENV is not consulted for the initiative
 * itself. Parts come back as loaded, which includes draft parts outside
 * production, so callers that must skip them filter on `part.draft`.
 */
export function loadAllInitiatives(
  options: { includeDrafts?: boolean; now?: Date } = {}
): Initiative[] {
  const { includeDrafts = false, now = new Date() } = options;
  return listInitiativeSlugs()
    .map((slug) => loadInitiative(slug, now))
    .filter((item) => includeDrafts || !item.draft);
}
```

- [ ] **Step 6: Create the collector from the existing index module**

Run: `cp lib/search/index.ts lib/search/collect.ts`

In `lib/search/collect.ts`, `stripMdxSyntax` stays exactly as copied (private). Replace the two import lines at the top:

```ts
import { getWritingSlugs, loadWriting } from '@/lib/writings';

import type { SearchableItem } from './types';
```

with:

```ts
import { STATIC_PAGES } from '@/lib/entities/pages';
import type { EntityCard } from '@/lib/entities/types';
import {
  type Initiative,
  type Part,
  loadAllInitiatives,
} from '@/lib/initiatives';
import { type WritingData, getWritingSlugs, loadWriting } from '@/lib/writings';

import { type SearchableItem, UNDATED } from './types';
```

Then replace everything from the doc comment `/**\n * Generates a search index from all published writings.` to the end of the file (the `generateSearchIndex` function and the final `export type` line) with:

```ts
export function writingToItem(
  writing: WritingData,
  content: string
): SearchableItem {
  return {
    slug: writing.slug,
    path: `/writings/${writing.slug}`,
    title: writing.title,
    description: writing.description,
    content: stripMdxSyntax(content),
    tags: writing.tags,
    published: new Date(writing.published).toISOString(),
    type: 'writing',
  };
}

function initiativeToItem(initiative: Initiative): SearchableItem {
  return {
    slug: `initiatives/${initiative.slug}`,
    path: initiative.href,
    title: initiative.title,
    description: initiative.description,
    content: [initiative.tagline, stripMdxSyntax(initiative.content)].join(
      '\n\n'
    ),
    tags: [initiative.kind],
    published: initiative.starts?.toISOString() ?? UNDATED,
    type: 'initiative',
  };
}

function partToItem(initiative: Initiative, part: Part): SearchableItem {
  return {
    slug: `initiatives/${initiative.slug}/${part.slug}`,
    path: `${initiative.href}/${part.slug}`,
    title: `${initiative.partLabel} ${part.number}: ${part.title}`,
    description: part.description ?? part.tagline ?? initiative.description,
    content: [
      part.tagline,
      part.places.map((place) => place.name).join(', '),
      stripMdxSyntax(part.content),
    ]
      .filter(Boolean)
      .join('\n\n'),
    tags: [initiative.title],
    published: part.starts.toISOString(),
    type: 'initiative',
  };
}

/** The initiative and each published part; nothing for a draft. */
export function initiativeToItems(initiative: Initiative): SearchableItem[] {
  if (initiative.draft) return [];
  return [
    initiativeToItem(initiative),
    ...initiative.parts
      .filter((part) => !part.draft)
      .map((part) => partToItem(initiative, part)),
  ];
}

export function pageToItem(page: EntityCard): SearchableItem {
  const key = page.href === '/' ? 'home' : page.href.replace(/^\//, '');
  return {
    slug: `pages/${key}`,
    path: page.href,
    title: page.title,
    description: page.description,
    content: page.description,
    tags: [],
    published: UNDATED,
    type: 'page',
  };
}

function byNewest(a: SearchableItem, b: SearchableItem): number {
  return new Date(b.published).getTime() - new Date(a.published).getTime();
}

/**
 * Everything the site's search covers: published writings, initiatives and
 * their parts, and the static pages. Drafts are excluded here rather than
 * trusted to the loaders, because the prebuild script runs outside Next.js
 * where the loaders show drafts. It reads through the uncached loaders for
 * the same reason: `cacheLife()` throws under plain Node.
 */
export async function collectSearchDocuments(): Promise<SearchableItem[]> {
  const slugs = await getWritingSlugs();
  const loaded = await Promise.all(slugs.map((slug) => loadWriting(slug)));
  const writings = loaded
    .filter(({ writing }) => !writing.draft)
    .map(({ writing, content }) => writingToItem(writing, content));
  const initiatives = loadAllInitiatives().flatMap(initiativeToItems);
  const pages = STATIC_PAGES.map(pageToItem);
  return [...writings, ...initiatives, ...pages].sort(byNewest);
}
```

- [ ] **Step 7: Point the old entry at the collector**

Replace the entire contents of `lib/search/index.ts` with:

```ts
import { collectSearchDocuments } from './collect';
import type { SearchableItem } from './types';

/**
 * Generates the search index for the whole site. The prebuild script and the
 * Postgres reindex route call this; the collector does the work.
 */
export async function generateSearchIndex(): Promise<SearchableItem[]> {
  return collectSearchDocuments();
}

export type { SearchableItem, SearchResult } from './types';
```

- [ ] **Step 8: Carry `path` through the other search modules**

In `lib/search/postgres.ts`, in the `results` mapping inside `searchPostgres`, replace:

```ts
    slug: row.slug,
    title: row.title,
```

with:

```ts
    slug: row.slug,
    path: row.url,
    title: row.title,
```

and in `indexItem`, replace:

```ts
const url =
  item.type === 'writing' ? `/writings/${item.slug}` : `/projects/${item.slug}`;
```

with:

```ts
const url = item.path;
```

In `lib/search/server.ts`, replace `searchResultPath`:

```ts
export function searchResultPath(result: SearchResult): string {
  return result.type === 'project'
    ? `/projects/${result.slug}`
    : `/writings/${result.slug}`;
}
```

with:

```ts
export function searchResultPath(result: SearchResult): string {
  return result.path;
}
```

In `tests/unit/search-rank.test.mts`, add a `path` to each fixture. Replace:

```ts
    slug: 'fall-tour-2026-begins',
    title: 'Fall Tour 2026 starts today.',
```

with:

```ts
    slug: 'fall-tour-2026-begins',
    path: '/writings/fall-tour-2026-begins',
    title: 'Fall Tour 2026 starts today.',
```

and replace:

```ts
    slug: 'project-superbloom',
    title: 'Project Superbloom',
```

with:

```ts
    slug: 'project-superbloom',
    path: '/writings/project-superbloom',
    title: 'Project Superbloom',
```

- [ ] **Step 9: Run the tests and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. 30 tests pass (22 existing plus the 8 new ones), typecheck clean.

- [ ] **Step 10: Format, lint, and commit**

```bash
pnpm exec prettier --write lib/search lib/entities lib/initiatives/index.ts tests/unit/search-collect.test.mts tests/unit/search-rank.test.mts
pnpm exec eslint lib/search lib/entities lib/initiatives/index.ts
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
feat(indieweb): Collect initiatives, parts, and pages for search

One collector now feeds search: writings, initiatives and their parts, and
the static pages, with drafts excluded explicitly. Items carry a path.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add lib/search lib/entities lib/initiatives/index.ts tests/unit/search-collect.test.mts tests/unit/search-rank.test.mts && git commit -F "$MSG"
```

---

### Task 2: Widen the server search

**Files:**

- Modify: `lib/search/types.ts`, `lib/search/server.ts`, `app/api/search/route.ts`, `components/SiteSearch.tsx`, `app/search/page.tsx`, `docs/indieweb/README.md`
- Test: `tests/unit/search-server.test.mts`

**Interfaces:**

- Consumes: `SearchableItem`, `UNDATED` (Task 1)
- Produces: `selectSearchable(items: SearchableItem[], type: SearchContentType): SearchableItem[]` from `@/lib/search/server`; `SearchContentType = 'writing' | 'initiative' | 'page' | 'all'`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/search-server.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { rankItems } from '@/lib/search/rank';
import { selectSearchable } from '@/lib/search/server';
import { type SearchableItem, UNDATED } from '@/lib/search/types';

const base = { description: '', content: '', tags: [], published: UNDATED };
const items: SearchableItem[] = [
  {
    ...base,
    slug: 'hello',
    path: '/writings/hello',
    title: 'Hello',
    type: 'writing',
  },
  {
    ...base,
    slug: 'initiatives/twd',
    path: '/initiatives/twd',
    title: 'The Willie Diaries',
    type: 'initiative',
  },
  {
    ...base,
    slug: 'pages/writings',
    path: '/writings',
    title: 'Writings',
    type: 'page',
  },
  {
    ...base,
    slug: 'greenhouse',
    path: '/projects/greenhouse',
    title: 'Greenhouse',
    type: 'project',
  },
];

test('selectSearchable never returns projects', () => {
  assert.deepEqual(
    selectSearchable(items, 'all').map((item) => item.slug),
    ['hello', 'initiatives/twd', 'pages/writings']
  );
});

test('selectSearchable narrows to one type', () => {
  assert.deepEqual(
    selectSearchable(items, 'initiative').map((item) => item.slug),
    ['initiatives/twd']
  );
});

test('rankItems keeps the path of an initiative result', () => {
  const [result] = rankItems(items, 'diaries');
  assert.equal(result.path, '/initiatives/twd');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test tests/unit/search-server.test.mts`
Expected: FAIL. `selectSearchable` is not exported from `@/lib/search/server`.

- [ ] **Step 3: Narrow the content type**

In `lib/search/types.ts`, replace:

```ts
export type SearchContentType = SearchableItem['type'] | 'all';
```

with:

```ts
/** What a query can be limited to. Projects are parked, so they never match. */
export type SearchContentType =
  | Exclude<SearchableItem['type'], 'project'>
  | 'all';
```

- [ ] **Step 4: Widen `searchContent`**

Replace the entire contents of `lib/search/server.ts` with:

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { generateSearchIndex } from './index';
import { rankItems, tokenize } from './rank';
import type {
  SearchContentType,
  SearchOptions,
  SearchResponse,
  SearchResult,
  SearchableItem,
} from './types';

const INDEX_PATH = join(process.cwd(), 'public', 'search-index.json');

/**
 * The JSON index is the default backend. Postgres full-text search only runs
 * when SEARCH_BACKEND=postgres is set and a database URL is present, so a
 * deploy with no database still answers /search from its own domain.
 */
export function usePostgresSearch(): boolean {
  return (
    process.env.SEARCH_BACKEND === 'postgres' &&
    Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL)
  );
}

let indexPromise: Promise<SearchableItem[]> | null = null;

/**
 * Load the search index. The prebuild script writes public/search-index.json;
 * when that file is missing or was written before items carried a path (dev
 * server, fresh checkout, stale file) the index is built from the content
 * directory on first use and cached for the process.
 */
export async function loadSearchIndex(): Promise<SearchableItem[]> {
  if (!indexPromise) {
    indexPromise = readFile(INDEX_PATH, 'utf8')
      .then((raw) => {
        const items = JSON.parse(raw) as SearchableItem[];
        if (items.some((item) => typeof item.path !== 'string')) {
          throw new Error('stale search index');
        }
        return items;
      })
      .catch(() => generateSearchIndex())
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

/**
 * The items a query may match. Projects never match while their pages are
 * parked in app/_(pages), because a result would link to a 404.
 */
export function selectSearchable(
  items: SearchableItem[],
  type: SearchContentType
): SearchableItem[] {
  return items.filter(
    (item) => item.type !== 'project' && (type === 'all' || item.type === type)
  );
}

export async function searchContent(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const { limit = 20, offset = 0, type = 'all' } = options;
  const trimmed = query.trim();
  const backend = usePostgresSearch() ? 'postgres' : 'index';

  if (!trimmed || tokenize(trimmed).length === 0) {
    return { results: [], total: 0, query: trimmed, backend };
  }

  if (backend === 'postgres') {
    const { searchPostgres } = await import('./postgres');
    return searchPostgres(trimmed, { type, limit, offset });
  }

  const items = await loadSearchIndex();
  const matches = rankItems(selectSearchable(items, type), trimmed);
  const results: SearchResult[] = matches.slice(offset, offset + limit);
  return { results, total: matches.length, query: trimmed, backend };
}

/** Site-relative URL for a search result. */
export function searchResultPath(result: SearchResult): string {
  return result.path;
}
```

- [ ] **Step 5: Update the API route**

In `app/api/search/route.ts`, replace:

```ts
const CONTENT_TYPES: SearchContentType[] = ['writing', 'project', 'all'];
```

with:

```ts
const CONTENT_TYPES: SearchContentType[] = [
  'writing',
  'initiative',
  'page',
  'all',
];
```

and replace the doc line:

```ts
 * - type: 'writing' | 'project' | 'all' (default: 'all')
```

with:

```ts
 * - type: 'writing' | 'initiative' | 'page' | 'all' (default: 'all')
```

- [ ] **Step 6: Update the search UI copy and date rule**

In `components/SiteSearch.tsx`, replace `placeholder="Search writings…"` with `placeholder="Search…"`.

Replace:

```tsx
          Type a word or two and press Search to look through every writing on
          this site.
```

with:

```tsx
          Type a word or two and press Search to look through everything on
          this site.
```

Replace:

```tsx
const published = new Date(result.published);
const formattedDate = Number.isNaN(published.getTime())
  ? ''
  : formatDate(published, 'short');
```

with:

```tsx
const published = new Date(result.published);
// Only writings show a date. Initiative dates are whole days and pages have
// none, and formatDate's zone shift would move a whole day back by one.
const formattedDate =
  result.type === 'writing' && !Number.isNaN(published.getTime())
    ? formatDate(published, 'short')
    : '';
```

Replace the entire contents of `app/search/page.tsx` with:

```tsx
import type { Metadata } from 'next/types';
import { Suspense } from 'react';

import SiteSearch from '@/components/SiteSearch';

import { site } from '@/lib/site';
import { isHiatusMode } from '@/lib/site-mode';

export const metadata: Metadata = {
  title: 'Search',
  description: `Search everything on ${new URL(site.origin).hostname}.`,
  robots: {
    index: false,
    follow: true,
  },
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <main className="mx-auto max-w-2xl px-lg py-2xl">
      <h1 className="mb-xl text-headline-large">Search</h1>
      {!isHiatusMode() && (
        <p className="mb-lg text-body-medium text-on-surface-variant">
          Press <kbd className="font-mono">⌘K</kbd> (Ctrl+K on Windows and
          Linux) on any page for instant search.
        </p>
      )}
      {/* searchParams is request data, so reading it must sit under Suspense
          for the static shell to prerender under Cache Components. */}
      <Suspense fallback={<SiteSearch />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchResults({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  return <SiteSearch query={q} />;
}
```

- [ ] **Step 7: Update the IndieWeb doc row**

In `docs/indieweb/README.md`, replace `Server-rendered search over writings, answered from this domain` with `Server-rendered search over writings, initiatives, and pages, answered from this domain`.

- [ ] **Step 8: Run the tests, typecheck, and check the live route**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. 33 tests pass, typecheck clean.

Start the dev server as a background task on port 3010 (`PORT=3010 pnpm dev:app`; stop that task afterwards, and do not `pkill` by name because other sessions run their own servers), then:

```bash
curl -s 'http://localhost:3010/api/search?q=initiatives'
curl -s 'http://localhost:3010/search?q=writings' | grep -o 'result[s]* for'
```

Expected: the JSON has `"total"` of at least 1 and a result with `"path":"/initiatives"` and `"type":"page"`; the second command prints `result for` or `results for`. Every initiative and writing in `content/` is currently a draft, so only the three static pages are searchable until one is published.

- [ ] **Step 9: Format, lint, and commit**

```bash
pnpm exec prettier --write lib/search app/api/search/route.ts app/search/page.tsx components/SiteSearch.tsx docs/indieweb/README.md tests/unit/search-server.test.mts
pnpm exec eslint lib/search app/api/search/route.ts app/search/page.tsx components/SiteSearch.tsx
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
feat(indieweb): Search initiatives and pages, not only writings

The server search now answers for writings, initiatives, and static pages.
Projects stay out while their pages are parked, and only writings show a date.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add lib/search app/api/search/route.ts app/search/page.tsx components/SiteSearch.tsx docs/indieweb/README.md tests/unit/search-server.test.mts && git commit -F "$MSG"
```

---

### Task 3: Build the Pagefind index

**Files:**

- Create: `lib/search/pagefind.ts`
- Modify: `scripts/generate-search-index.ts`, `.gitignore`, `package.json`, `pnpm-lock.yaml`, `docs/indieweb/README.md`
- Test: `tests/unit/search-pagefind.test.mts`

**Interfaces:**

- Consumes: `SearchableItem`, `UNDATED` (Task 1); `site.language` from `@/lib/site`
- Produces: `toPagefindRecord(item: SearchableItem): PagefindRecord` and `buildPagefindIndex(items: SearchableItem[], outputPath: string): Promise<void>` from `@/lib/search/pagefind`; `public/pagefind/` written by `pnpm search:index`

- [ ] **Step 1: Add the dependency**

Run: `pnpm add -D pagefind`
Expected: `package.json` gains `"pagefind"` under `devDependencies`. If pnpm prints `Ignored build scripts: pagefind`, add `pagefind: true` under `allowBuilds:` in `pnpm-workspace.yaml` and run `pnpm install`. Confirm with `pnpm exec pagefind --version`, which prints a version.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/search-pagefind.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { toPagefindRecord } from '@/lib/search/pagefind';
import { type SearchableItem, UNDATED } from '@/lib/search/types';

const item: SearchableItem = {
  slug: 'hello',
  path: '/writings/hello',
  title: 'Hello',
  description: 'A note.',
  content: 'Body text.',
  tags: ['personal'],
  published: '2026-01-04T00:00:00.000Z',
  type: 'writing',
};

test('toPagefindRecord maps an item to a custom record', () => {
  assert.deepEqual(toPagefindRecord(item), {
    url: '/writings/hello',
    language: 'en',
    content: 'A note.\n\nBody text.',
    meta: { title: 'Hello', description: 'A note.', type: 'writing' },
    filters: { type: ['writing'], tag: ['personal'] },
    sort: { date: '2026-01-04T00:00:00.000Z' },
  });
});

test('toPagefindRecord omits empty tags and the sort key for undated items', () => {
  const record = toPagefindRecord({
    ...item,
    tags: [],
    published: UNDATED,
    type: 'page',
  });
  assert.deepEqual(record.filters, { type: ['page'] });
  assert.ok(!('sort' in record));
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec tsx --test tests/unit/search-pagefind.test.mts`
Expected: FAIL. The `@/lib/search/pagefind` module cannot be found.

- [ ] **Step 4: Implement the mapper and index builder**

Create `lib/search/pagefind.ts`:

```ts
import { rm } from 'node:fs/promises';

import { site } from '@/lib/site';

import { type SearchableItem, UNDATED } from './types';

export interface PagefindRecord {
  url: string;
  content: string;
  language: string;
  meta: Record<string, string>;
  filters: Record<string, string[]>;
  sort?: Record<string, string>;
}

/** Maps a search item to the shape Pagefind's `addCustomRecord` takes. */
export function toPagefindRecord(item: SearchableItem): PagefindRecord {
  return {
    url: item.path,
    language: site.language,
    content: [item.description, item.content].filter(Boolean).join('\n\n'),
    meta: {
      title: item.title,
      description: item.description,
      type: item.type,
    },
    filters: {
      type: [item.type],
      ...(item.tags.length > 0 ? { tag: item.tags } : {}),
    },
    ...(item.published === UNDATED ? {} : { sort: { date: item.published } }),
  };
}

/**
 * Builds the Pagefind index from search items and writes it to `outputPath`,
 * replacing whatever was there. Throws if Pagefind reports any error, so a
 * broken index fails the build instead of shipping.
 */
export async function buildPagefindIndex(
  items: SearchableItem[],
  outputPath: string
): Promise<void> {
  const pagefind = await import('pagefind');
  const { index, errors: createErrors } = await pagefind.createIndex();
  if (!index) {
    throw new Error(
      `Pagefind could not create an index: ${createErrors.join('; ')}`
    );
  }
  try {
    for (const item of items) {
      const { errors } = await index.addCustomRecord(toPagefindRecord(item));
      if (errors.length > 0) {
        throw new Error(`Pagefind rejected ${item.path}: ${errors.join('; ')}`);
      }
    }
    await rm(outputPath, { recursive: true, force: true });
    const { errors } = await index.writeFiles({ outputPath });
    if (errors.length > 0) {
      throw new Error(
        `Pagefind could not write ${outputPath}: ${errors.join('; ')}`
      );
    }
  } finally {
    await pagefind.close();
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec tsx --test tests/unit/search-pagefind.test.mts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Build the index from the prebuild script**

Replace the entire contents of `scripts/generate-search-index.ts` with:

```ts
/**
 * Script to generate the search indexes at build time.
 * Run with: pnpm exec tsx scripts/generate-search-index.ts
 *
 * Writes public/search-index.json (the server-rendered /search) and the
 * Pagefind index in public/pagefind/ (the ⌘K modal) from one collection.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateSearchIndex } from '../lib/search';
import { buildPagefindIndex } from '../lib/search/pagefind';

async function main() {
  console.log('Generating search index...');

  const index = await generateSearchIndex();

  const outputPath = join(process.cwd(), 'public', 'search-index.json');
  writeFileSync(outputPath, JSON.stringify(index, null, 2));

  console.log(`Search index generated with ${index.length} items`);
  console.log(`Output: ${outputPath}`);

  const pagefindPath = join(process.cwd(), 'public', 'pagefind');
  await buildPagefindIndex(index, pagefindPath);
  console.log(`Pagefind index written to ${pagefindPath}`);
}

main().catch((error) => {
  console.error('Failed to generate search index:', error);
  process.exit(1);
});
```

In `.gitignore`, replace:

```
/public/search-index.json
```

with:

```
/public/search-index.json
/public/pagefind/
```

- [ ] **Step 7: Run it and check what Pagefind emitted**

Run: `pnpm search:index && ls public/pagefind`
Expected: output ends with `Pagefind index written to .../public/pagefind`, and the listing includes `pagefind.js`, `pagefind-entry.json`, an `index` directory, and a `fragment` directory.

Then run: `ls public/pagefind | grep component-ui`
Expected: `pagefind-component-ui.css` and `pagefind-component-ui.js`. **Record whether both are present.** If either is missing, Task 4 uses its fallback (the `@pagefind/component-ui` package).

Run: `git status --short public`
Expected: no output. Both generated paths are ignored.

- [ ] **Step 8: Document the script**

In `docs/indieweb/README.md`, replace ``Writes `public/search-index.json` from published writings. The file is gitignored.`` with ``Writes `public/search-index.json` and the Pagefind index in `public/pagefind/` from published writings, initiatives, and pages. Both are gitignored.``

- [ ] **Step 9: Typecheck, format, lint, and commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. 35 tests pass, typecheck clean. If `import('pagefind')` reports missing types, read `node_modules/pagefind/types/index.d.ts` and adjust the destructuring in `buildPagefindIndex` to the declared names.

```bash
pnpm exec prettier --write lib/search/pagefind.ts scripts/generate-search-index.ts docs/indieweb/README.md tests/unit/search-pagefind.test.mts
pnpm exec eslint lib/search/pagefind.ts scripts/generate-search-index.ts
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
feat(indieweb): Build a Pagefind index beside the search index

The prebuild script now writes public/pagefind from the same collected items
as the JSON index, so the ⌘K modal and /search cover the same content.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add lib/search/pagefind.ts scripts/generate-search-index.ts .gitignore package.json pnpm-lock.yaml pnpm-workspace.yaml docs/indieweb/README.md tests/unit/search-pagefind.test.mts && git commit -F "$MSG"
```

---

### Task 4: The ⌘K search dialog

**Files:**

- Create: `components/search/pagefind.d.ts`, `components/search/search.css`, `components/search/SearchModal.tsx`
- Modify: `app/layout.tsx`, `components/site/TopBar.tsx`, `components/home/Rail.tsx`, `docs/indieweb/README.md`

**Interfaces:**

- Consumes: `public/pagefind/` from Task 3, including `pagefind-component-ui.js` and `.css` (Task 3 Step 7 recorded whether they exist)
- Produces: `<SearchModal />` (default export of `components/search/SearchModal.tsx`); the custom elements `<pagefind-modal>` and `<pagefind-modal-trigger>` usable in any JSX

This task is UI, so it has no unit test. Verification is a typecheck, a curl check, and a browser check in Step 9.

- [ ] **Step 1: Declare the custom elements for JSX**

Create `components/search/pagefind.d.ts`:

```ts
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type PagefindElement<Attributes = object> = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> &
  Attributes;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'pagefind-modal': PagefindElement<{
        'reset-on-close'?: boolean;
        instance?: string;
      }>;
      'pagefind-modal-trigger': PagefindElement<{
        compact?: boolean;
        'hide-shortcut'?: boolean;
        shortcut?: string;
        placeholder?: string;
        instance?: string;
      }>;
    }
  }
}
```

- [ ] **Step 2: Theme the components with the site palette**

Create `components/search/search.css`:

```css
/* Pagefind search. The Component UI sets `all: initial` on its host
   elements, so it takes its look from these custom properties alone. */
:root {
  --pf-text: var(--color-ink);
  --pf-background: var(--color-card);
  --pf-border: var(--color-line);
  --pf-border-radius: 12px;
  --pf-outline-focus: var(--color-accent);
  --pf-mark: var(--color-ink);
  --pf-font: var(--font-sans);
  --pf-input-height: 44px;
  --pf-input-font-size: 16px;
}

/* Hold the trigger's space until the element upgrades so the bar does not
   shift when the script arrives. */
pagefind-modal-trigger:not(:defined) {
  display: inline-block;
  min-width: 2.25rem;
  min-height: 2.25rem;
}

.rail-search {
  margin-top: 1.25rem;
}
```

- [ ] **Step 3: Write the dialog component**

Create `components/search/SearchModal.tsx`:

```tsx
'use client';

import { useEffect } from 'react';

import './search.css';

const COMPONENT_UI = '/pagefind/pagefind-component-ui';

/**
 * Adds Pagefind's Component UI to the page once. The script defines the
 * <pagefind-modal> and <pagefind-modal-trigger> elements and registers the
 * ⌘K / Ctrl+K shortcut. The search index and its WASM load later still, on
 * the first search.
 */
function loadComponentUi() {
  if (document.querySelector('script[data-pagefind-ui]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${COMPONENT_UI}.css`;
  document.head.append(link);

  const script = document.createElement('script');
  script.type = 'module';
  script.src = `${COMPONENT_UI}.js`;
  script.dataset.pagefindUi = '';
  document.head.append(script);
}

/**
 * Mounts the search dialog and loads its script once the page is idle, so
 * search never competes with first paint. Triggers elsewhere on the page
 * (`<pagefind-modal-trigger>`) find this dialog through the shared default
 * instance.
 */
export default function SearchModal() {
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(loadComponentUi);
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(loadComponentUi, 200);
    return () => window.clearTimeout(id);
  }, []);

  return <pagefind-modal />;
}
```

- [ ] **Step 4: Mount it once in the root layout**

In `app/layout.tsx`, replace:

```tsx
import SiteFooter from '@/components/site/SiteFooter';
```

with:

```tsx
import SearchModal from '@/components/search/SearchModal';
import SiteFooter from '@/components/site/SiteFooter';
```

and replace:

```tsx
        {children}
        <SiteFooter />
        <Analytics />
```

with:

```tsx
{
  children;
}
<SiteFooter />;
{
  !isHiatus && <SearchModal />;
}
<Analytics />;
```

- [ ] **Step 5: Add the trigger to the top bar**

In `components/site/TopBar.tsx`, replace:

```tsx
            {crumb.label}
          </SiteLink>
        </span>
      ))}
    </header>
```

with:

```tsx
            {crumb.label}
          </SiteLink>
        </span>
      ))}
      <div className="ml-auto flex items-center">
        <pagefind-modal-trigger compact />
        <noscript>
          <SiteLink
            preview={false}
            href="/search"
            className="transition-colors hover:text-ink"
          >
            Search
          </SiteLink>
        </noscript>
      </div>
    </header>
```

- [ ] **Step 6: Add the trigger to the home rail**

In `components/home/Rail.tsx`, replace:

```tsx
        <nav className="index" aria-label="What he’s building">
```

with:

```tsx
        <div className="rail-search">
          <pagefind-modal-trigger />
        </div>

        <nav className="index" aria-label="What he’s building">
```

- [ ] **Step 7: Document the dialog**

In `docs/indieweb/README.md`, replace ``Postgres, `SEARCH_REINDEX_SECRET` |`` with:

```
Postgres, `SEARCH_REINDEX_SECRET` |
| ⌘K on any page | Pagefind dialog over the same content as `/search`; its index is served from `/pagefind/` | nothing |
```

- [ ] **Step 8: Typecheck and lint**

Run: `pnpm typecheck && pnpm exec eslint components/search components/site/TopBar.tsx components/home/Rail.tsx app/layout.tsx`
Expected: PASS. If typecheck reports that `pagefind-modal` is not a valid JSX element, confirm `components/search/pagefind.d.ts` is inside the `include` globs (`**/*.ts` covers it) and that the file begins with an `import` (that is what makes the `declare module 'react'` block an augmentation).

- [ ] **Step 9: Verify in the browser**

Run: `pnpm search:index`
Start the dev server as a background task (`PORT=3010 pnpm dev:app`); stop that task when done.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3010/pagefind/pagefind-component-ui.js
curl -s http://localhost:3010/initiatives | grep -c 'pagefind-modal'
```

Expected: `200`, then a count of at least 2 (the trigger and the dialog element).

In a browser at `http://localhost:3010/initiatives`:

1. Press Cmd+K (Ctrl+K off macOS). The dialog opens with the input focused.
2. Type `writings`. The list shows a result titled Writings that links to `/writings`.
3. Press Esc. The dialog closes and focus returns to the page.
4. Narrow the window to 390px. The top bar's trigger stays on the row with no horizontal scroll.
5. Open `http://localhost:3010/`. The rail shows a Search trigger between the intro and the venture list, and the tile grid layout is unchanged.

If the trigger looks wrong against the warm palette, adjust the `--pf-*` values in `components/search/search.css` until it fits.

- [ ] **Step 10: Fallback if the Component UI files were not emitted**

Only if Task 3 Step 7 found no `pagefind-component-ui.*` in `public/pagefind/`, or Step 9's curl returned 404:

Run: `pnpm add @pagefind/component-ui@$(pnpm exec pagefind --version | awk '{print $NF}')`

Replace `components/search/SearchModal.tsx` with:

```tsx
'use client';

import '@pagefind/component-ui/css';
import { useEffect } from 'react';

import './search.css';

/**
 * Mounts the search dialog and loads Pagefind's Component UI from the npm
 * package once the page has hydrated. The script defines the dialog and
 * trigger elements and registers the ⌘K / Ctrl+K shortcut.
 */
export default function SearchModal() {
  useEffect(() => {
    void import('@pagefind/component-ui');
  }, []);

  return <pagefind-modal />;
}
```

If `pnpm typecheck` then reports TS7016 for `@pagefind/component-ui`, create `components/search/component-ui.d.ts` with exactly:

```ts
declare module '@pagefind/component-ui';
declare module '@pagefind/component-ui/css';
```

Re-run Step 9 (skip the curl for the script file).

- [ ] **Step 11: Format and commit**

```bash
pnpm exec prettier --write components/search app/layout.tsx components/site/TopBar.tsx components/home/Rail.tsx docs/indieweb/README.md
pnpm exec eslint components/search app/layout.tsx components/site/TopBar.tsx components/home/Rail.tsx
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
feat(indieweb): Open site search with ⌘K on every page

A Pagefind dialog mounts once in the root layout and loads at idle. The top
bar and the home rail carry its trigger; hiatus mode does not mount it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add components/search app/layout.tsx components/site/TopBar.tsx components/home/Rail.tsx docs/indieweb/README.md package.json pnpm-lock.yaml && git commit -F "$MSG"
```

---

### Task 5: Social-card metadata in `pageMetadata()`

**Files:**

- Modify: `lib/site.ts`
- Test: `tests/unit/seo-metadata.test.mts`

**Interfaces:**

- Produces (used by Tasks 8 and 9): `pageMetadata()` also accepts `imageAlt?: string`, `publishedTime?: Date | string`, `modifiedTime?: Date | string`, `tags?: string[]`, `section?: string`, and `labels?: Array<[label: string, value: string]>`. Images come out as `{ url, width: 1200, height: 630, alt }` for Open Graph and `{ url, alt }` for Twitter.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/seo-metadata.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { absoluteUrl, pageMetadata, site } from '@/lib/site';

type Loose = Record<string, unknown>;
type Meta = ReturnType<typeof pageMetadata>;

const openGraph = (meta: Meta) => meta.openGraph as Loose;
const twitter = (meta: Meta) => meta.twitter as Loose;

const input = { title: 'Writings', description: 'Notes.', path: '/writings' };

test('the site card is the default image, with dimensions and alt text', () => {
  const meta = pageMetadata(input);
  assert.deepEqual(openGraph(meta).images, [
    { url: site.ogImage, width: 1200, height: 630, alt: site.shortDescription },
  ]);
  assert.deepEqual(twitter(meta).images, [
    { url: site.ogImage, alt: site.shortDescription },
  ]);
  assert.equal(openGraph(meta).title, 'Writings');
  assert.equal(openGraph(meta).url, '/writings');
  assert.deepEqual(meta.alternates, { canonical: '/writings' });
});

test('a custom image takes its alt from imageAlt, else the title', () => {
  const image = '/writings/opengraph-image';
  const plain = pageMetadata({ ...input, image });
  assert.deepEqual(openGraph(plain).images, [
    { url: image, width: 1200, height: 630, alt: 'Writings' },
  ]);
  const described = pageMetadata({ ...input, image, imageAlt: 'A pen.' });
  assert.deepEqual(twitter(described).images, [{ url: image, alt: 'A pen.' }]);
});

test('article fields are set only for articles', () => {
  const article = openGraph(
    pageMetadata({
      ...input,
      type: 'article',
      publishedTime: new Date('2026-01-04T00:00:00Z'),
      modifiedTime: '2026-02-01T00:00:00Z',
      tags: ['personal'],
      section: 'Superbloom',
    })
  );
  assert.equal(article.type, 'article');
  assert.equal(article.publishedTime, '2026-01-04T00:00:00.000Z');
  assert.equal(article.modifiedTime, '2026-02-01T00:00:00.000Z');
  assert.deepEqual(article.tags, ['personal']);
  assert.equal(article.section, 'Superbloom');
  assert.deepEqual(article.authors, [absoluteUrl('/')]);

  const website = openGraph(
    pageMetadata({ ...input, publishedTime: '2026-01-04' })
  );
  assert.ok(!('publishedTime' in website));
  assert.ok(!('authors' in website));
});

test('labels become Slack unfurl pairs, capped at two', () => {
  const meta = pageMetadata({
    ...input,
    labels: [
      ['Reading time', '4 min'],
      ['Published', 'Jan 4, 2026'],
      ['Extra', 'ignored'],
    ],
  });
  assert.deepEqual(meta.other, {
    'twitter:label1': 'Reading time',
    'twitter:data1': '4 min',
    'twitter:label2': 'Published',
    'twitter:data2': 'Jan 4, 2026',
  });
  assert.equal(pageMetadata(input).other, undefined);
});

test('noIndex keeps links followable', () => {
  assert.deepEqual(pageMetadata({ ...input, noIndex: true }).robots, {
    index: false,
    follow: true,
  });
  assert.equal(pageMetadata(input).robots, undefined);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test tests/unit/seo-metadata.test.mts`
Expected: FAIL. The image assertions fail because images are still plain strings.

- [ ] **Step 3: Extend the input type**

In `lib/site.ts`, replace:

```ts
  /** Site-relative or absolute image URL for social cards. */
  image?: string;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
}
```

with:

```ts
  /** Site-relative or absolute image URL for social cards (1200×630). */
  image?: string;
  /**
   * Alt text for the social image. Defaults to the title, or to the site
   * tagline when the page uses the site card.
   */
  imageAlt?: string;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
  /** Article fields. Only used when `type` is 'article'. */
  publishedTime?: Date | string;
  modifiedTime?: Date | string;
  tags?: string[];
  section?: string;
  /** Label and value pairs Slack shows under the link preview (first two). */
  labels?: Array<[label: string, value: string]>;
}
```

- [ ] **Step 4: Add two helpers above the function**

In `lib/site.ts`, replace:

```ts
/**
 * Build page metadata that keeps the site name out of the OpenGraph title.
```

with:

```ts
function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

/** Slack shows up to two label and value pairs under a link preview. */
function slackLabels(labels: Array<[string, string]>): Record<string, string> {
  return Object.fromEntries(
    labels
      .slice(0, 2)
      .flatMap(([label, value], index) => [
        [`twitter:label${index + 1}`, label],
        [`twitter:data${index + 1}`, value],
      ])
  );
}

/**
 * Build page metadata that keeps the site name out of the OpenGraph title.
```

- [ ] **Step 5: Extend the function**

In `lib/site.ts`, replace:

```ts
  image,
  type = 'website',
  noIndex = false,
}: PageMetadataInput): Metadata {
```

with:

```ts
  image,
  imageAlt,
  type = 'website',
  noIndex = false,
  publishedTime,
  modifiedTime,
  tags,
  section,
  labels,
}: PageMetadataInput): Metadata {
```

and replace the body from `const images = ...` to the end of the function:

```ts
  const images = [image ?? site.ogImage];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      siteName: site.name,
      locale: site.locale,
      title,
      description,
      url: path,
      type,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
```

with:

```ts
  const url = image ?? site.ogImage;
  const alt = imageAlt ?? (image ? title : site.shortDescription);
  const shared = {
    siteName: site.name,
    locale: site.locale,
    title,
    description,
    url: path,
    images: [{ url, width: 1200, height: 630, alt }],
  };
  const openGraph: Metadata['openGraph'] =
    type === 'article'
      ? {
          ...shared,
          type,
          authors: [absoluteUrl('/')],
          ...(publishedTime ? { publishedTime: toIso(publishedTime) } : {}),
          ...(modifiedTime ? { modifiedTime: toIso(modifiedTime) } : {}),
          ...(tags && tags.length > 0 ? { tags } : {}),
          ...(section ? { section } : {}),
        }
      : { ...shared, type };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url, alt }],
    },
    ...(labels && labels.length > 0 ? { other: slackLabels(labels) } : {}),
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. 40 tests pass, typecheck clean. Existing callers pass a subset of the new input, so none should break. If TypeScript rejects the `openGraph` conditional, annotate each branch with `satisfies NonNullable<Metadata['openGraph']>` rather than loosening the type.

- [ ] **Step 7: Format, lint, and commit**

```bash
pnpm exec prettier --write lib/site.ts tests/unit/seo-metadata.test.mts
pnpm exec eslint lib/site.ts
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
feat: Give social cards sized images, alt text, article fields, and labels

pageMetadata now emits image objects with dimensions and alt text, article
authorship and tags, and the label pairs Slack shows in link previews.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add lib/site.ts tests/unit/seo-metadata.test.mts && git commit -F "$MSG"
```

---

### Task 6: JSON-LD builders

**Files:**

- Modify: `lib/site.ts`
- Create: `lib/seo/jsonld.ts`, `components/seo/JsonLd.tsx`
- Test: `tests/unit/seo-jsonld.test.mts`

**Interfaces:**

- Produces (used by Tasks 7, 8, 9):
  - `type JsonLdNode = Record<string, unknown>`
  - `ids: { website: string; person: string }`
  - `graph(...nodes: JsonLdNode[]): JsonLdNode`
  - `websiteLd()`, `personLd()`, `profilePageLd()`, `homeGraph()`, all returning `JsonLdNode`
  - `blogPostingLd(input: { path: string; title: string; description: string; published: Date | string; updated?: Date | string; tags: string[]; image: string; seriesName?: string }): JsonLdNode`
  - `eventLd(input: { path: string; name: string; description?: string; starts: Date; ends: Date; places: Array<{ name: string; region?: string; lat: number; lng: number }>; image?: string }): JsonLdNode | null`
  - `breadcrumbLd(crumbs: Array<{ name: string; path: string }>): JsonLdNode`
  - `serializeJsonLd(data: JsonLdNode): string`
  - `<JsonLd data={JsonLdNode} />` as the default export of `components/seo/JsonLd.tsx`
  - `site.ventures: readonly { key: string; name: string; url: string }[]`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/seo-jsonld.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  blogPostingLd,
  breadcrumbLd,
  eventLd,
  graph,
  homeGraph,
  personLd,
  profilePageLd,
  serializeJsonLd,
  websiteLd,
} from '@/lib/seo/jsonld';
import { site } from '@/lib/site';

/** A node with an `undefined` value would not survive JSON, so it fails here. */
function assertPlain(node: unknown) {
  assert.deepEqual(JSON.parse(JSON.stringify(node)), node);
}

test('websiteLd names the site and its short name', () => {
  const node = websiteLd();
  assert.equal(node['@type'], 'WebSite');
  assert.equal(node.name, site.name);
  assert.equal(node.alternateName, 'WillieCubed');
  assert.equal(node.url, `${site.origin}/`);
  assertPlain(node);
});

test('personLd links the profiles, lists the ventures, and hides the email', () => {
  const node = personLd();
  assert.equal(node['@type'], 'Person');
  assert.deepEqual(
    node.sameAs,
    site.social.map((profile) => profile.href)
  );
  assert.ok(!('email' in node));
  const orgs = node.worksFor as Array<Record<string, unknown>>;
  assert.equal(orgs.length, site.ventures.length);
  assert.ok(orgs.every((org) => org['@type'] === 'Organization'));
  assert.ok(orgs.every((org) => String(org.url).startsWith('https://')));
  assertPlain(node);
});

test('profilePageLd points at the person', () => {
  assert.deepEqual(profilePageLd().mainEntity, { '@id': personLd()['@id'] });
});

test('homeGraph holds the website, the person, and the profile page', () => {
  const home = homeGraph();
  assert.equal(home['@context'], 'https://schema.org');
  const types = (home['@graph'] as Array<Record<string, unknown>>).map(
    (node) => node['@type']
  );
  assert.deepEqual(types, ['WebSite', 'Person', 'ProfilePage']);
});

test('blogPostingLd carries dates, author, image, keywords, and series', () => {
  const post = blogPostingLd({
    path: '/writings/hello',
    title: 'Hello',
    description: 'A note.',
    published: new Date('2026-01-04T00:00:00Z'),
    updated: '2026-02-01T00:00:00Z',
    tags: ['personal', 'music'],
    image: '/writings/hello/opengraph-image',
    seriesName: 'Superbloom',
  });
  assert.equal(post['@type'], 'BlogPosting');
  assert.equal(post.headline, 'Hello');
  assert.equal(post.url, `${site.origin}/writings/hello`);
  assert.equal(post.datePublished, '2026-01-04T00:00:00.000Z');
  assert.equal(post.dateModified, '2026-02-01T00:00:00.000Z');
  assert.equal(post.image, `${site.origin}/writings/hello/opengraph-image`);
  assert.equal(post.keywords, 'personal, music');
  assert.deepEqual(post.author, { '@id': personLd()['@id'] });
  assert.deepEqual(post.isPartOf, {
    '@type': 'CreativeWorkSeries',
    name: 'Superbloom',
  });
  assertPlain(post);
});

test('blogPostingLd omits what it does not have', () => {
  const post = blogPostingLd({
    path: '/writings/hello',
    title: 'Hello',
    description: 'A note.',
    published: '2026-01-04T00:00:00Z',
    tags: [],
    image: '/writings/hello/opengraph-image',
  });
  assert.ok(!('dateModified' in post));
  assert.ok(!('keywords' in post));
  assert.ok(!('isPartOf' in post));
  assertPlain(post);
});

const eventBase = {
  path: '/initiatives/fall-tour-2026/part-1',
  name: 'Part 1: Las Vegas',
  starts: new Date(2026, 8, 18),
  ends: new Date(2026, 8, 20),
  places: [],
};

test('eventLd is null without a place', () => {
  assert.equal(eventLd(eventBase), null);
});

test('eventLd describes a scheduled in-person event', () => {
  const event = eventLd({
    ...eventBase,
    places: [{ name: 'Las Vegas', region: 'NV', lat: 36.17, lng: -115.14 }],
    image: '/initiatives/fall-tour-2026/part-1/opengraph-image',
  });
  assert.ok(event);
  assert.equal(event['@type'], 'Event');
  assert.equal(event.startDate, '2026-09-18');
  assert.equal(event.endDate, '2026-09-20');
  assert.equal(event.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(
    event.eventAttendanceMode,
    'https://schema.org/OfflineEventAttendanceMode'
  );
  assert.deepEqual(event.location, [
    {
      '@type': 'Place',
      name: 'Las Vegas',
      address: 'Las Vegas, NV',
      geo: { '@type': 'GeoCoordinates', latitude: 36.17, longitude: -115.14 },
    },
  ]);
  assert.deepEqual(event.organizer, { '@id': personLd()['@id'] });
  assertPlain(event);
});

test('breadcrumbLd numbers the trail and makes the links absolute', () => {
  const trail = breadcrumbLd([
    { name: 'Initiatives', path: '/initiatives' },
    { name: 'Fall Tour', path: '/initiatives/fall-tour-2026' },
  ]);
  assert.deepEqual(trail.itemListElement, [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Initiatives',
      item: `${site.origin}/initiatives`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Fall Tour',
      item: `${site.origin}/initiatives/fall-tour-2026`,
    },
  ]);
});

test('serializeJsonLd cannot close its own script tag', () => {
  const out = serializeJsonLd({ name: '</script><b>x' });
  assert.ok(!out.includes('</script'));
  assert.equal(JSON.parse(out).name, '</script><b>x');
});

test('graph wraps nodes with the schema.org context', () => {
  assert.deepEqual(graph({ a: 1 }, { b: 2 }), {
    '@context': 'https://schema.org',
    '@graph': [{ a: 1 }, { b: 2 }],
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test tests/unit/seo-jsonld.test.mts`
Expected: FAIL. The `@/lib/seo/jsonld` module cannot be found.

- [ ] **Step 3: List the ventures in the site config**

In `lib/site.ts`, replace:

```ts
/** Hostnames that redirect into the canonical origin. */
```

with:

```ts
  /** The ventures Willie runs, for structured data. */
  ventures: [
    {
      key: 'lvbt',
      name: 'Las Vegans for Better Transit',
      url: 'https://lasvegasfortransit.org/',
    },
    {
      key: 'hypertext',
      name: 'Hypertext Studio',
      url: 'https://hypertext.studio/',
    },
    {
      key: 'rtc',
      name: 'Reasonable Tech Company',
      url: 'https://reasonabletech.co/',
    },
  ],
  /** Hostnames that redirect into the canonical origin. */
```

- [ ] **Step 4: Write the builders**

Create `lib/seo/jsonld.ts`:

```ts
import { absoluteUrl, site } from '@/lib/site';

export type JsonLdNode = Record<string, unknown>;

/**
 * Stable ids, so a node on one page can point at an entity on another.
 * Consumers only resolve an `@id` inside the same document, so a page whose
 * nodes reference the person includes `personLd()` in its own graph.
 */
export const ids = {
  website: absoluteUrl('/#website'),
  person: absoluteUrl('/#person'),
} as const;

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

/** A calendar day in the local zone, which is how the site stores its dates. */
function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function graph(...nodes: JsonLdNode[]): JsonLdNode {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

export function websiteLd(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': ids.website,
    url: absoluteUrl('/'),
    name: site.name,
    alternateName: site.shortName,
    description: site.description,
    inLanguage: site.language,
    publisher: { '@id': ids.person },
  };
}

export function personLd(): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': ids.person,
    name: site.author.name,
    givenName: site.author.givenName,
    familyName: site.author.familyName,
    url: absoluteUrl('/'),
    image: absoluteUrl(site.author.photo),
    description: site.shortDescription,
    sameAs: site.social.map((profile) => profile.href),
    worksFor: site.ventures.map((venture) => ({
      '@type': 'Organization',
      '@id': absoluteUrl(`/#org-${venture.key}`),
      name: venture.name,
      url: venture.url,
    })),
  };
}

export function profilePageLd(): JsonLdNode {
  return {
    '@type': 'ProfilePage',
    '@id': absoluteUrl('/#profile'),
    url: absoluteUrl('/'),
    name: site.name,
    inLanguage: site.language,
    mainEntity: { '@id': ids.person },
    isPartOf: { '@id': ids.website },
  };
}

export function homeGraph(): JsonLdNode {
  return graph(websiteLd(), personLd(), profilePageLd());
}

export interface BlogPostingInput {
  path: string;
  title: string;
  description: string;
  published: Date | string;
  updated?: Date | string;
  tags: string[];
  /** Site-relative or absolute image URL. */
  image: string;
  seriesName?: string;
}

export function blogPostingLd(input: BlogPostingInput): JsonLdNode {
  const url = absoluteUrl(input.path);
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: input.title,
    description: input.description,
    datePublished: toIso(input.published),
    ...(input.updated ? { dateModified: toIso(input.updated) } : {}),
    author: { '@id': ids.person },
    publisher: { '@id': ids.person },
    image: absoluteUrl(input.image),
    inLanguage: site.language,
    ...(input.tags.length > 0 ? { keywords: input.tags.join(', ') } : {}),
    ...(input.seriesName
      ? {
          isPartOf: { '@type': 'CreativeWorkSeries', name: input.seriesName },
        }
      : {}),
  };
}

export interface EventInput {
  path: string;
  name: string;
  description?: string;
  starts: Date;
  ends: Date;
  places: Array<{ name: string; region?: string; lat: number; lng: number }>;
  /** Site-relative or absolute image URL. */
  image?: string;
}

/**
 * An in-person event, or null when it has no place: Google requires a
 * location, and markup that fails that requirement is worse than none.
 */
export function eventLd(input: EventInput): JsonLdNode | null {
  if (!input.name || input.places.length === 0) return null;
  const url = absoluteUrl(input.path);
  return {
    '@type': 'Event',
    '@id': `${url}#event`,
    url,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    startDate: isoDay(input.starts),
    endDate: isoDay(input.ends),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: input.places.map((place) => ({
      '@type': 'Place',
      name: place.name,
      address: place.region ? `${place.name}, ${place.region}` : place.name,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: place.lat,
        longitude: place.lng,
      },
    })),
    organizer: { '@id': ids.person },
    ...(input.image ? { image: [absoluteUrl(input.image)] } : {}),
  };
}

export function breadcrumbLd(
  crumbs: Array<{ name: string; path: string }>
): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * Serializes for a `<script type="application/ld+json">` body. `<` is
 * escaped so a title containing `</script>` cannot end the tag early.
 */
export function serializeJsonLd(data: JsonLdNode): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
```

Create `components/seo/JsonLd.tsx`:

```tsx
import { type JsonLdNode, serializeJsonLd } from '@/lib/seo/jsonld';

/** Renders one JSON-LD script tag. The data is escaped by serializeJsonLd. */
export default function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. 51 tests pass, typecheck clean.

- [ ] **Step 6: Format, lint, and commit**

```bash
pnpm exec prettier --write lib/site.ts lib/seo components/seo tests/unit/seo-jsonld.test.mts
pnpm exec eslint lib/site.ts lib/seo components/seo
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
feat: Add JSON-LD builders for the site, person, posts, and events

Pure builders for WebSite, Person, ProfilePage, BlogPosting, Event, and
BreadcrumbList, plus a script-tag component that escapes what it renders.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add lib/site.ts lib/seo components/seo tests/unit/seo-jsonld.test.mts && git commit -F "$MSG"
```

---

### Task 7: Site icons, robots directives, and the home page's structured data

**Files:**

- Modify: `app/layout.tsx`, `app/page.tsx`

**Interfaces:**

- Consumes: `homeGraph()` from `@/lib/seo/jsonld` and `<JsonLd>` from `@/components/seo/JsonLd` (Task 6)

This task is wiring, so it has no unit test; Step 5 verifies it against the built HTML.

- [ ] **Step 1: Declare icons and the manifest in the root metadata**

In `app/layout.tsx`, replace:

```tsx
const isHiatus = isHiatusMode();
```

with:

```tsx
/** Google shows the favicon in results only when it is a multiple of 48px. */
const SITE_ICONS: Metadata['icons'] = {
  icon: [
    { url: '/brand/web/icon-48.png', sizes: '48x48', type: 'image/png' },
    { url: '/icon.svg', type: 'image/svg+xml' },
  ],
  apple: '/apple-touch-icon.png',
};
const SITE_MANIFEST = '/manifest.webmanifest';

const isHiatus = isHiatusMode();
```

Replace the end of the hiatus branch:

```tsx
        nocache: true,
      },
    }
  : {
```

with:

```tsx
        nocache: true,
      },
      icons: SITE_ICONS,
      manifest: SITE_MANIFEST,
    }
  : {
```

Replace the end of the live branch:

```tsx
      twitter: {
        card: 'summary_large_image',
      },
    };
```

with:

```tsx
      twitter: {
        card: 'summary_large_image',
      },
      icons: SITE_ICONS,
      manifest: SITE_MANIFEST,
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-image-preview': 'large',
          'max-snippet': -1,
          'max-video-preview': -1,
        },
      },
    };
```

Replace the live branch's root card image:

```tsx
        images: [site.ogImage],
```

with:

```tsx
        images: [
          {
            url: site.ogImage,
            width: 1200,
            height: 630,
            alt: site.shortDescription,
          },
        ],
```

- [ ] **Step 2: Give the home page's social card an explicit image**

In `app/page.tsx`, the live metadata sets its own `openGraph`, which replaces the layout's, so the card had no explicit image. Replace:

```tsx
    openGraph: {
      title: site.name,
      description: site.shortDescription,
      url: '/',
      type: 'profile',
      firstName: site.author.givenName,
      lastName: site.author.familyName,
    },
    twitter: {
      title: site.name,
      description: site.shortDescription,
    },
```

with:

```tsx
    openGraph: {
      siteName: site.name,
      locale: site.locale,
      title: site.name,
      description: site.shortDescription,
      url: '/',
      type: 'profile',
      firstName: site.author.givenName,
      lastName: site.author.familyName,
      images: [
        {
          url: site.ogImage,
          width: 1200,
          height: 630,
          alt: site.shortDescription,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: site.name,
      description: site.shortDescription,
      images: [{ url: site.ogImage, alt: site.shortDescription }],
    },
```

- [ ] **Step 3: Render the home graph**

In `app/page.tsx`, replace:

```tsx
import Playbill from '@/components/initiatives/Playbill';
```

with:

```tsx
import Playbill from '@/components/initiatives/Playbill';
import JsonLd from '@/components/seo/JsonLd';
```

Replace:

```tsx
import { getFeaturedInitiatives } from '@/lib/initiatives';
```

with:

```tsx
import { getFeaturedInitiatives } from '@/lib/initiatives';
import { homeGraph } from '@/lib/seo/jsonld';
```

Replace the live return:

```tsx
return (
  <HomeShell
    brands={allBrandVars()}
    detailCountdown={<CountdownDays deadline={LVBT_DEADLINE} />}
    extraEntries={facetEntries(featuredTiles)}
  >
    <Rail />
    <TileGrid tiles={getHomeTiles(featuredTiles)} playbills={playbills} />
  </HomeShell>
);
```

with:

```tsx
return (
  <>
    <JsonLd data={homeGraph()} />
    <HomeShell
      brands={allBrandVars()}
      detailCountdown={<CountdownDays deadline={LVBT_DEADLINE} />}
      extraEntries={facetEntries(featuredTiles)}
    >
      <Rail />
      <TileGrid tiles={getHomeTiles(featuredTiles)} playbills={playbills} />
    </HomeShell>
  </>
);
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. If `Metadata['icons']` rejects the `sizes` or `type` keys, read the `Icon` type in `node_modules/next/dist/lib/metadata/types/metadata-types.d.ts` and match its field names.

- [ ] **Step 5: Verify the rendered head**

Start the dev server as a background task (`PORT=3010 pnpm dev:app`), then:

```bash
F="$(git rev-parse --git-dir)/home.html"
curl -s http://localhost:3010/ > "$F"
grep -o '<link rel="icon"[^>]*>' "$F"
grep -o '<link rel="manifest"[^>]*>' "$F"
grep -o '<meta name="robots"[^>]*>' "$F"
grep -o '<meta name="googlebot"[^>]*>' "$F"
grep -o '<meta property="og:image"[^>]*>' "$F"
node -e "const h=require('fs').readFileSync(process.argv[1],'utf8');const m=h.match(/<script type=\"application\/ld\+json\">(.*?)<\/script>/s);console.log(JSON.parse(m[1])['@graph'].map((n)=>n['@type']).join(','))" "$F"
```

Expected:

- two `icon` links (the 48×48 PNG and the SVG), and a `manifest` link to `/manifest.webmanifest`
- `robots` content `index, follow`, and `googlebot` content containing `max-image-preview:large` and `max-snippet:-1`
- exactly one `og:image` tag, pointing at `/brand/social/og-image.png` on `willie.page`. If there are two, the file-based `app/opengraph-image.png` is also being injected: remove `images` from the `openGraph` block in Step 2 and keep the twitter images.
- the last command prints `WebSite,Person,ProfilePage`

- [ ] **Step 6: Format, lint, and commit**

```bash
pnpm exec prettier --write app/layout.tsx app/page.tsx
pnpm exec eslint app/layout.tsx app/page.tsx
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
feat(landing): Describe the site and its author in structured data

Adds WebSite, Person, and ProfilePage JSON-LD to the home page, declares the
favicon and manifest that were never linked, and lets Google show large
image previews and full snippets.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add app/layout.tsx app/page.tsx && git commit -F "$MSG"
```

---

### Task 8: Writings metadata, article markup, and the index card

**Files:**

- Create: `app/writings/opengraph-image.tsx`
- Modify: `app/writings/page.tsx`, `app/writings/[slug]/page.tsx`

**Interfaces:**

- Consumes: `pageMetadata()` with article fields and labels (Task 5); `blogPostingLd`, `breadcrumbLd`, `graph`, `personLd` and `<JsonLd>` (Task 6); `renderEntityImage` from `@/lib/og/render`

This task is wiring, so it has no unit test; Step 6 verifies it.

- [ ] **Step 1: Add the index social card**

Create `app/writings/opengraph-image.tsx`:

```tsx
import { renderEntityImage } from '@/lib/og/render';

export const alt = 'Writings by Willie Chalmers III';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return renderEntityImage({
    title: 'Writings',
    description:
      'Thoughts, tutorials, and notes on software, music, and creativity.',
  });
}
```

- [ ] **Step 2: Move the index page onto `pageMetadata`**

In `app/writings/page.tsx`, replace `import { absoluteUrl, site } from '@/lib/site';` with `import { absoluteUrl, pageMetadata, site } from '@/lib/site';`.

Replace:

```tsx
export const metadata: Metadata = {
  title: 'Writings',
  description:
    'Thoughts, tutorials, and notes on software, music, and creativity.',
  openGraph: {
    title: "Willie's Writings",
    description:
      'Thoughts, tutorials, and notes on software, music, and creativity.',
    url: '/writings',
  },
  alternates: {
    canonical: '/writings',
    types: {
      'application/rss+xml': '/writings/feed.xml',
      'application/atom+xml': '/writings/feed/atom',
      'application/feed+json': '/writings/feed/json',
    },
  },
};
```

with:

```tsx
const writingsMetadata = pageMetadata({
  title: 'Writings',
  description:
    'Thoughts, tutorials, and notes on software, music, and creativity.',
  path: '/writings',
  image: '/writings/opengraph-image',
  imageAlt: 'Writings by Willie Chalmers III',
});

export const metadata: Metadata = {
  ...writingsMetadata,
  alternates: {
    ...writingsMetadata.alternates,
    types: {
      'application/rss+xml': '/writings/feed.xml',
      'application/atom+xml': '/writings/feed/atom',
      'application/feed+json': '/writings/feed/json',
    },
  },
};
```

- [ ] **Step 3: Move a post's metadata onto `pageMetadata`**

In `app/writings/[slug]/page.tsx`, replace:

```tsx
import TopBar from '@/components/site/TopBar';
```

with:

```tsx
import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';
```

Replace:

```tsx
import { absoluteRoute } from '@/lib/site';
```

with:

```tsx
import { blogPostingLd, breadcrumbLd, graph, personLd } from '@/lib/seo/jsonld';
import { absoluteRoute, formatDate, pageMetadata } from '@/lib/site';
```

In `generateMetadata`, replace:

```tsx
  const canonicalUrl = generateCanonicalUrl(writing.slug);
  return {
    title: writing.title,
    description: writing.description,
    alternates: {
      canonical: canonicalUrl,
      types: {
```

with:

```tsx
  const canonicalUrl = generateCanonicalUrl(writing.slug);
  const path = `/writings/${writing.slug}`;
  const metadata = pageMetadata({
    title: writing.title,
    description: writing.description,
    path,
    image: `${path}/opengraph-image`,
    imageAlt: writing.featuredImageAlt || writing.title,
    type: 'article',
    publishedTime: writing.published,
    modifiedTime: writing.lastUpdated,
    tags: writing.tags,
    labels: [
      ['Reading time', `${writing.readingTime} min`],
      ['Published', formatDate(writing.published)],
    ],
  });
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      types: {
```

and replace the tail of the same function:

```tsx
      },
    },
    openGraph: {
      type: 'article',
      title: writing.title,
      description: writing.description,
      publishedTime: new Date(writing.published).toISOString(),
      modifiedTime: new Date(writing.lastUpdated).toISOString(),
      url: canonicalUrl,
      images: writing.featuredImage ? [writing.featuredImage] : undefined,
    },
  };
}
```

with:

```tsx
      },
    },
  };
}
```

- [ ] **Step 4: Render the article graph**

In the page component of `app/writings/[slug]/page.tsx`, replace:

```tsx
  const canonicalUrl = generateCanonicalUrl(writing.slug);

  return (
    <>
      <TopBar
        column="reading"
```

with:

```tsx
  const canonicalUrl = generateCanonicalUrl(writing.slug);
  const path = `/writings/${writing.slug}`;

  return (
    <>
      <JsonLd
        data={graph(
          blogPostingLd({
            path,
            title: writing.title,
            description: writing.description,
            published: writing.published,
            updated: writing.lastUpdated,
            tags: writing.tags,
            image: writing.featuredImage || `${path}/opengraph-image`,
            seriesName: seriesData?.name,
          }),
          breadcrumbLd([
            { name: 'Writings', path: '/writings' },
            { name: writing.title, path },
          ]),
          personLd()
        )}
      />
      <TopBar
        column="reading"
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. If the `openGraph` spread in `generateMetadata` conflicts with `Metadata`, the `...metadata` spread and the `alternates` override are the only shape changes; check the `alternates` type first.

- [ ] **Step 6: Verify the rendered pages**

Every writing is a draft, and drafts render only in development, so use the dev server (`PORT=3010 pnpm dev:app` as a background task):

```bash
F="$(git rev-parse --git-dir)/post.html"
curl -s http://localhost:3010/writings/project-superbloom > "$F"
grep -o '<meta property="og:image"[^>]*>' "$F"
grep -o '<meta property="article:tag"[^>]*>' "$F"
grep -o '<meta name="twitter:label1"[^>]*>' "$F"
grep -o '<link rel="canonical"[^>]*>' "$F"
node -e "const h=require('fs').readFileSync(process.argv[1],'utf8');const m=h.match(/<script type=\"application\/ld\+json\">(.*?)<\/script>/s);console.log(JSON.parse(m[1])['@graph'].map((n)=>n['@type']).join(','))" "$F"
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:3010/writings/opengraph-image
curl -s http://localhost:3010/writings | grep -o '<meta property="og:image"[^>]*>'
```

Expected: `og:image` ends in `/writings/project-superbloom/opengraph-image`; one `article:tag` for `personal`; a `twitter:label1` of `Reading time`; a canonical of `https://willie.page/writings/project-superbloom`; the JSON-LD types `BlogPosting,BreadcrumbList,Person`; then `200 image/png`; then an `og:image` ending in `/writings/opengraph-image`.

- [ ] **Step 7: Format, lint, and commit**

```bash
pnpm exec prettier --write app/writings
pnpm exec eslint app/writings
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
feat(writings): Add article structured data and a social card for the index

Posts now emit BlogPosting and breadcrumb JSON-LD, a sized social image with
alt text, article tags, and Slack labels. The index gets its own card and its
Open Graph title is now the plain page title.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add app/writings && git commit -F "$MSG"
```

---

### Task 9: Initiative breadcrumbs, event markup, and brand theme colour

**Files:**

- Create: `lib/initiatives/viewport.ts`, `app/initiatives/opengraph-image.tsx`
- Modify: `app/initiatives/page.tsx`, `app/initiatives/[slug]/page.tsx`, `app/initiatives/[slug]/[part]/page.tsx`
- Test: `tests/unit/initiative-viewport.test.mts`

**Interfaces:**

- Consumes: `pageMetadata()` `imageAlt` and `labels` (Task 5); `breadcrumbLd`, `eventLd`, `graph`, `personLd` and `<JsonLd>` (Task 6)
- Produces: `viewportForBrand(brand: string | undefined): Viewport` and `initiativeViewport(slug: string): Promise<Viewport>` from `@/lib/initiatives/viewport`

The theme-colour lookup lives once, in `lib/initiatives/viewport.ts`, and both pages call it (Steps 1 to 3). The rest of the task is wiring with no unit test of its own; Step 9 verifies it.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/initiative-viewport.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { viewportForBrand } from '@/lib/initiatives/viewport';

test('viewportForBrand uses a #rrggbb brand as the theme colour', () => {
  assert.deepEqual(viewportForBrand('#ef8f2b'), { themeColor: '#ef8f2b' });
});

test('viewportForBrand leaves the site colour for a seed key or no brand', () => {
  assert.deepEqual(viewportForBrand('lvbt'), {});
  assert.deepEqual(viewportForBrand('#abc'), {});
  assert.deepEqual(viewportForBrand(undefined), {});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test tests/unit/initiative-viewport.test.mts`
Expected: FAIL. The `@/lib/initiatives/viewport` module cannot be found.

- [ ] **Step 3: Implement the helper and run the test**

Create `lib/initiatives/viewport.ts`:

```ts
import type { Viewport } from 'next';

import { getInitiative } from './index';

/**
 * Only a `#rrggbb` brand can be a theme colour. A seed key or no brand
 * leaves the site colour set in the root layout.
 */
export function viewportForBrand(brand: string | undefined): Viewport {
  return brand && /^#[0-9a-fA-F]{6}$/.test(brand) ? { themeColor: brand } : {};
}

/** Tints the browser chrome with an initiative's brand colour. */
export async function initiativeViewport(slug: string): Promise<Viewport> {
  const initiative = await getInitiative(slug).catch(() => null);
  return viewportForBrand(initiative?.brand);
}
```

Run: `pnpm exec tsx --test tests/unit/initiative-viewport.test.mts`
Expected: PASS, 2 tests.

- [ ] **Step 4: Add the index social card**

Create `app/initiatives/opengraph-image.tsx`:

```tsx
import { renderEntityImage } from '@/lib/og/render';

export const alt = 'Initiatives from Willie Chalmers III';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return renderEntityImage({
    title: 'Initiatives',
    description:
      'The campaigns, series, and projects Willie is running right now.',
  });
}
```

In `app/initiatives/page.tsx`, replace:

```tsx
  path: '/initiatives',
});
```

with:

```tsx
  path: '/initiatives',
  image: '/initiatives/opengraph-image',
  imageAlt: 'Initiatives from Willie Chalmers III',
});
```

- [ ] **Step 5: Initiative page: imports and metadata**

In `app/initiatives/[slug]/page.tsx`, replace `import type { Metadata } from 'next';` with `import type { Metadata, Viewport } from 'next';`.

Replace:

```tsx
import SiteLink from '@/components/link/SiteLink';
import TopBar from '@/components/site/TopBar';
```

with:

```tsx
import SiteLink from '@/components/link/SiteLink';
import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';
```

Replace:

```tsx
import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import { pageMetadata } from '@/lib/site';
```

with:

```tsx
import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import { initiativeViewport } from '@/lib/initiatives/viewport';
import { breadcrumbLd, graph } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/site';
```

Replace:

```tsx
      path: initiative.href,
      image: `${initiative.href}/opengraph-image`,
    });
```

with:

```tsx
      path: initiative.href,
      image: `${initiative.href}/opengraph-image`,
      imageAlt: `${initiative.title}: ${initiative.tagline}`,
      labels:
        initiative.starts && initiative.ends
          ? [['Dates', formatRange(initiative.starts, initiative.ends, true)]]
          : undefined,
    });
```

- [ ] **Step 6: Initiative page: theme colour and breadcrumb graph**

In `app/initiatives/[slug]/page.tsx`, replace:

```tsx
export default async function InitiativePage(props: {
```

with:

```tsx
/** Tints the browser chrome with the initiative's brand colour. */
export async function generateViewport(props: {
  params: Promise<{ slug: string }>;
}): Promise<Viewport> {
  const { slug } = await props.params;
  return initiativeViewport(slug);
}

export default async function InitiativePage(props: {
```

Replace:

```tsx
<TopBar crumbs={crumbs} column="content" />
```

with:

```tsx
      <JsonLd
        data={graph(
          breadcrumbLd([
            ...crumbs.map((crumb) => ({ name: crumb.label, path: crumb.href })),
            { name: initiative.title, path: initiative.href },
          ])
        )}
      />
      <TopBar crumbs={crumbs} column="content" />
```

- [ ] **Step 7: Part page: imports, metadata, and theme colour**

In `app/initiatives/[slug]/[part]/page.tsx`, replace `import type { Metadata } from 'next';` with `import type { Metadata, Viewport } from 'next';`.

Replace:

```tsx
import SiteLink from '@/components/link/SiteLink';
import TopBar from '@/components/site/TopBar';
```

with:

```tsx
import SiteLink from '@/components/link/SiteLink';
import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';
```

Replace:

```tsx
import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import { pageMetadata } from '@/lib/site';
```

with:

```tsx
import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import { initiativeViewport } from '@/lib/initiatives/viewport';
import { breadcrumbLd, eventLd, graph, personLd } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/site';
```

Replace the metadata call:

```tsx
return pageMetadata({
  title: `${initiative.partLabel} ${part.number}: ${part.title}`,
  description: part.description ?? part.tagline ?? initiative.description,
  path: `${initiative.href}/${part.slug}`,
  image: `${initiative.href}/${part.slug}/opengraph-image`,
  type: 'article',
});
```

with:

```tsx
const labels: Array<[string, string]> = [
  ['When', formatRange(part.starts, part.ends, true)],
];
if (part.places.length > 0) {
  labels.push(['Where', part.places.map((place) => place.name).join(', ')]);
}
return pageMetadata({
  title: `${initiative.partLabel} ${part.number}: ${part.title}`,
  description: part.description ?? part.tagline ?? initiative.description,
  path: `${initiative.href}/${part.slug}`,
  image: `${initiative.href}/${part.slug}/opengraph-image`,
  type: 'article',
  labels,
});
```

Replace:

```tsx
export default async function PartPage(props: {
```

with:

```tsx
/** Tints the browser chrome with the initiative's brand colour. */
export async function generateViewport(props: {
  params: Promise<{ slug: string; part: string }>;
}): Promise<Viewport> {
  const { slug } = await props.params;
  return initiativeViewport(slug);
}

export default async function PartPage(props: {
```

- [ ] **Step 8: Part page: the breadcrumb and event graph**

In `app/initiatives/[slug]/[part]/page.tsx`, replace:

```tsx
  const cover = part.cover ?? initiative.cover;

  return (
    <div className="initiative" style={schemeStyleFromHex(initiative.brand)}>
      <TopBar
```

with:

```tsx
  const cover = part.cover ?? initiative.cover;
  const partPath = `${initiative.href}/${part.slug}`;
  const partTitle = `${initiative.partLabel} ${part.number}: ${part.title}`;
  const event = eventLd({
    path: partPath,
    name: partTitle,
    description: part.description ?? part.tagline,
    starts: part.starts,
    ends: part.ends,
    places: part.places,
    image: `${partPath}/opengraph-image`,
  });
  const partGraph = graph(
    breadcrumbLd([
      { name: 'Initiatives', path: '/initiatives' },
      { name: initiative.title, path: initiative.href },
      { name: partTitle, path: partPath },
    ]),
    personLd(),
    ...(event ? [event] : [])
  );

  return (
    <div className="initiative" style={schemeStyleFromHex(initiative.brand)}>
      <JsonLd data={partGraph} />
      <TopBar
```

- [ ] **Step 9: Typecheck and verify**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. 53 tests pass, typecheck clean.

Every initiative is a draft, and drafts render only in development, so use the dev server (`PORT=3010 pnpm dev:app` as a background task):

```bash
F="$(git rev-parse --git-dir)/part.html"
curl -s http://localhost:3010/initiatives/fall-tour-2026/part-1 > "$F"
grep -o '<meta name="theme-color"[^>]*>' "$F"
grep -o '<meta name="twitter:label1"[^>]*>' "$F"
node -e "const h=require('fs').readFileSync(process.argv[1],'utf8');const m=h.match(/<script type=\"application\/ld\+json\">(.*?)<\/script>/s);const g=JSON.parse(m[1])['@graph'];console.log(g.map((n)=>n['@type']).join(','));const e=g.find((n)=>n['@type']==='Event');console.log(e&&e.startDate,e&&e.location.length)" "$F"
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:3010/initiatives/opengraph-image
curl -s http://localhost:3010/initiatives | grep -o '<meta property="og:image"[^>]*>'
```

Expected: a `theme-color` meta whose content is the initiative's hex brand (when its frontmatter `brand` is a `#rrggbb`; a key such as `lvbt` leaves the site colour); a `twitter:label1` of `When`; JSON-LD types `BreadcrumbList,Person,Event` and an Event `startDate` in `YYYY-MM-DD` form with at least one location; then `200 image/png`; then an `og:image` ending in `/initiatives/opengraph-image`.

If the fall-tour part has no places in its frontmatter, the Event is correctly absent: open `content/initiatives/fall-tour-2026/parts/1.mdx`, confirm `places:` is empty, and check `part-2` instead.

- [ ] **Step 10: Format, lint, and commit**

```bash
pnpm exec prettier --write app/initiatives lib/initiatives/viewport.ts tests/unit/initiative-viewport.test.mts
pnpm exec eslint app/initiatives lib/initiatives/viewport.ts
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
feat(initiatives): Add breadcrumbs, event markup, and brand theme colour

Initiative pages emit breadcrumb JSON-LD and tint the browser chrome with
their brand colour. Parts with a place also emit Event markup, and the index
gets its own social card.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add app/initiatives lib/initiatives/viewport.ts tests/unit/initiative-viewport.test.mts && git commit -F "$MSG"
```

---

### Task 10: Correct the crawler rules

**Files:**

- Modify: `app/robots.ts`
- Test: `tests/unit/seo-robots.test.mts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/seo-robots.test.mts`:

```ts
import robots from '@/app/robots';
import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/lib/site';

const result = robots();
const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

function agents(rule: { userAgent?: string | string[] }): string[] {
  return [rule.userAgent ?? []].flat();
}

/** Every user agent that is kept out of /writings/. */
const blockedFromWritings = rules
  .filter((rule) => [rule.disallow ?? []].flat().includes('/writings/'))
  .flatMap(agents);

test('training crawlers are kept out of /writings/ under their real tokens', () => {
  for (const token of [
    'GPTBot',
    'Google-Extended',
    'ClaudeBot',
    'anthropic-ai',
    'Applebot-Extended',
    'meta-externalagent',
    'CCBot',
  ]) {
    assert.ok(blockedFromWritings.includes(token), `${token} is not blocked`);
  }
});

test('the invented Googlebot-Extended token is gone', () => {
  assert.ok(!blockedFromWritings.includes('Googlebot-Extended'));
});

test('search and link-preview bots are never blocked from /writings/', () => {
  for (const bot of [
    'Googlebot',
    'Bingbot',
    'Slackbot',
    'LinkedInBot',
    'facebookexternalhit',
    'Twitterbot',
  ]) {
    assert.ok(!blockedFromWritings.includes(bot), `${bot} must stay allowed`);
  }
});

test('everyone else keeps the site but not the API', () => {
  const everyone = rules.find((rule) => agents(rule).includes('*'));
  assert.ok(everyone);
  assert.equal(everyone.allow, '/');
  assert.ok([everyone.disallow ?? []].flat().includes('/api/'));
});

test('the sitemap is announced on the canonical origin', () => {
  assert.equal(result.sitemap, `${site.origin}/sitemap.xml`);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test tests/unit/seo-robots.test.mts`
Expected: FAIL. `Google-Extended`, `ClaudeBot`, `Applebot-Extended`, and `meta-externalagent` are not blocked yet, and `Googlebot-Extended` still is.

- [ ] **Step 3: Correct the crawler list**

In `app/robots.ts`, replace:

```ts
      // Maybe reconsider this?
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'Googlebot-Extended',
          'CCBot',
          'anthropic-ai',
          'Omgilibot',
          'FacebookBot',
        ],
        disallow: ['/writings/'],
      },
```

with:

```ts
      // AI training crawlers stay out of the writings. Search crawlers and
      // link-preview bots (Slackbot, LinkedInBot, facebookexternalhit,
      // Twitterbot) are deliberately not listed, so results and unfurls work.
      // Google-Extended is the real opt-out token for Gemini training;
      // Googlebot-Extended is not a token and did nothing.
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'Google-Extended',
          'ClaudeBot',
          'anthropic-ai',
          'Applebot-Extended',
          'meta-externalagent',
          'FacebookBot',
          'CCBot',
          'Omgilibot',
        ],
        disallow: ['/writings/'],
      },
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. 58 tests pass, typecheck clean.

- [ ] **Step 5: Format, lint, and commit**

```bash
pnpm exec prettier --write app/robots.ts tests/unit/seo-robots.test.mts
pnpm exec eslint app/robots.ts
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
fix: Block AI training crawlers under their real user-agent tokens

Googlebot-Extended is not a token, so Google's training crawler was never
blocked from /writings/. Uses Google-Extended and adds ClaudeBot,
Applebot-Extended, and meta-externalagent. Link-preview bots stay allowed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add app/robots.ts tests/unit/seo-robots.test.mts && git commit -F "$MSG"
```

---

### Task 11: A truthful sitemap

**Files:**

- Create: `lib/seo/sitemap.ts`
- Modify: `app/sitemap.ts`, `lib/initiatives/schema.ts`, `docs/initiatives.md`
- Test: `tests/unit/seo-sitemap.test.mts`

**Interfaces:**

- Produces: `buildSitemap(input: { writings: WritingData[]; initiatives: Initiative[] }): MetadataRoute.Sitemap` from `@/lib/seo/sitemap`; `updated?: Date` on `Initiative` and `Part`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/seo-sitemap.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import type { Initiative, Part } from '@/lib/initiatives';
import { buildSitemap } from '@/lib/seo/sitemap';
import { site } from '@/lib/site';
import type { WritingData } from '@/lib/writings';

function part(overrides: Partial<Part> = {}): Part {
  return {
    number: 1,
    title: 'Las Vegas',
    starts: new Date(2026, 8, 18),
    ends: new Date(2026, 8, 20),
    places: [],
    milestones: [],
    draft: false,
    slug: 'part-1',
    initiative: 'fall-tour-2026',
    status: 'planned',
    content: '',
    ...overrides,
  };
}

function initiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    title: 'Fall Tour 2026',
    tagline: 'A tour.',
    description: 'A tour.',
    kind: 'campaign',
    partLabel: 'Part',
    links: [],
    syndication: [],
    draft: false,
    slug: 'fall-tour-2026',
    status: 'planned',
    content: '',
    parts: [part()],
    href: '/initiatives/fall-tour-2026',
    ends: new Date(2026, 10, 1),
    ...overrides,
  };
}

function writing(overrides: Partial<WritingData> = {}): WritingData {
  return {
    slug: 'hello',
    title: 'Hello',
    description: 'A note.',
    published: new Date('2026-01-04T00:00:00Z'),
    lastUpdated: new Date('2026-02-01T00:00:00Z'),
    tags: [],
    draft: false,
    readingTime: 1,
    postType: 'article',
    ...overrides,
  };
}

test('every entry is absolute, unique, and free of ignored hints', () => {
  const entries = buildSitemap({
    writings: [writing()],
    initiatives: [initiative()],
  });
  const urls = entries.map((entry) => entry.url);
  assert.deepEqual(urls, [
    `${site.origin}/`,
    `${site.origin}/writings`,
    `${site.origin}/initiatives`,
    `${site.origin}/initiatives/fall-tour-2026`,
    `${site.origin}/initiatives/fall-tour-2026/part-1`,
    `${site.origin}/writings/hello`,
  ]);
  assert.equal(new Set(urls).size, urls.length);
  for (const entry of entries) {
    assert.ok(!('priority' in entry));
    assert.ok(!('changeFrequency' in entry));
  }
});

test('lastModified is set only from a known edit date', () => {
  const entries = buildSitemap({
    writings: [writing()],
    initiatives: [
      initiative({
        updated: new Date(2026, 8, 1),
        parts: [
          part(),
          part({ number: 2, slug: 'part-2', updated: new Date(2026, 8, 2) }),
        ],
      }),
    ],
  });
  const byUrl = new Map(entries.map((entry) => [entry.url, entry]));
  assert.equal(byUrl.get(`${site.origin}/`)?.lastModified, undefined);
  assert.deepEqual(
    byUrl.get(`${site.origin}/initiatives/fall-tour-2026`)?.lastModified,
    new Date(2026, 8, 1)
  );
  assert.equal(
    byUrl.get(`${site.origin}/initiatives/fall-tour-2026/part-1`)?.lastModified,
    undefined
  );
  assert.deepEqual(
    byUrl.get(`${site.origin}/initiatives/fall-tour-2026/part-2`)?.lastModified,
    new Date(2026, 8, 2)
  );
  assert.deepEqual(
    byUrl.get(`${site.origin}/writings/hello`)?.lastModified,
    new Date('2026-02-01T00:00:00Z')
  );
});

test('the event end date is never used as a modified date', () => {
  const entries = buildSitemap({ writings: [], initiatives: [initiative()] });
  const entry = entries.find((item) => item.url.endsWith('/fall-tour-2026'));
  assert.equal(entry?.lastModified, undefined);
});

test('drafts are left out even if a loader hands them over', () => {
  const entries = buildSitemap({
    writings: [writing({ slug: 'secret', draft: true })],
    initiatives: [
      initiative({ slug: 'hidden', href: '/initiatives/hidden', draft: true }),
      initiative({
        parts: [part(), part({ number: 2, slug: 'part-2', draft: true })],
      }),
    ],
  });
  const urls = entries.map((entry) => entry.url);
  assert.ok(!urls.some((url) => url.includes('secret')));
  assert.ok(!urls.some((url) => url.includes('hidden')));
  assert.ok(!urls.some((url) => url.endsWith('/part-2')));
  assert.ok(urls.includes(`${site.origin}/initiatives/fall-tour-2026/part-1`));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test tests/unit/seo-sitemap.test.mts`
Expected: FAIL. The `@/lib/seo/sitemap` module cannot be found.

- [ ] **Step 3: Add the optional `updated` date to the schema**

In `lib/initiatives/schema.ts`, in `InitiativeFrontmatterSchema`, replace:

```ts
  starts: DateSchema.optional(),
  ends: DateSchema.optional(),
  /** A key in lib/brand/seeds.json or a `#rrggbb` hex. */
```

with:

```ts
  starts: DateSchema.optional(),
  ends: DateSchema.optional(),
  /** The last day the page was meaningfully edited. Feeds the sitemap. */
  updated: DateSchema.optional(),
  /** A key in lib/brand/seeds.json or a `#rrggbb` hex. */
```

In `PartFrontmatterSchema`, replace:

```ts
  starts: DateSchema,
  ends: DateSchema,
  status: StatusSchema.optional(),
  places: z.array(PlaceSchema).default([]),
```

with:

```ts
  starts: DateSchema,
  ends: DateSchema,
  /** The last day the page was meaningfully edited. Feeds the sitemap. */
  updated: DateSchema.optional(),
  status: StatusSchema.optional(),
  places: z.array(PlaceSchema).default([]),
```

- [ ] **Step 4: Write the sitemap builder**

Create `lib/seo/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next';

import type { Initiative } from '@/lib/initiatives';
import { absoluteUrl } from '@/lib/site';
import type { WritingData } from '@/lib/writings';

type Entry = MetadataRoute.Sitemap[number];

/** An entry with a lastModified only when there is a real edit date to give. */
function entry(path: string, lastModified?: Date | string): Entry {
  return lastModified
    ? { url: absoluteUrl(path), lastModified }
    : { url: absoluteUrl(path) };
}

/**
 * The sitemap for the routed pages. Google ignores `changeFrequency` and
 * `priority`, and it stops trusting `lastModified` once a site gets it wrong,
 * so dates come only from an edit date the content carries and never from an
 * event's own dates. Drafts are dropped here as well as in the loaders.
 */
export function buildSitemap(input: {
  writings: WritingData[];
  initiatives: Initiative[];
}): MetadataRoute.Sitemap {
  const initiatives = input.initiatives
    .filter((item) => !item.draft)
    .flatMap((item) => [
      entry(item.href, item.updated),
      ...item.parts
        .filter((part) => !part.draft)
        .map((part) => entry(`${item.href}/${part.slug}`, part.updated)),
    ]);
  const writings = input.writings
    .filter((item) => !item.draft)
    .map((item) => entry(`/writings/${item.slug}`, item.lastUpdated));
  return [
    entry('/'),
    entry('/writings'),
    entry('/initiatives'),
    ...initiatives,
    ...writings,
  ];
}
```

Replace the entire contents of `app/sitemap.ts` with:

```ts
import type { MetadataRoute } from 'next';

import { getInitiatives } from '@/lib/initiatives';
import { buildSitemap } from '@/lib/seo/sitemap';
import { getAllWritings } from '@/lib/writings';

/**
 * Generates the sitemap for the whole website.
 *
 * Only routed pages belong here. Pages parked in app/_(pages) are left
 * out until they are rebuilt and routed again.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [initiatives, writings] = await Promise.all([
    getInitiatives(),
    getAllWritings(),
  ]);
  return buildSitemap({ initiatives, writings });
}
```

- [ ] **Step 5: Document the field**

In `docs/initiatives.md`, replace the initiative row:

```
| `ends`        | no       | ISO date. Falls back to the last part's end.                                                               |
```

with:

```
| `ends`        | no       | ISO date. Falls back to the last part's end.                                                               |
| `updated`     | no       | ISO date of the last real edit. Sets the sitemap's last-modified date; leave it out when unsure.           |
```

and replace the part row:

```
| `ends`        | yes      | ISO date.                                                                |
```

with:

```
| `ends`        | yes      | ISO date.                                                                |
| `updated`     | no       | ISO date of the last real edit. Sets the sitemap's last-modified date.   |
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. 62 tests pass, typecheck clean.

- [ ] **Step 7: Format, lint, and commit**

```bash
pnpm exec prettier --write lib/seo/sitemap.ts app/sitemap.ts lib/initiatives/schema.ts docs/initiatives.md tests/unit/seo-sitemap.test.mts
pnpm exec eslint lib/seo/sitemap.ts app/sitemap.ts lib/initiatives/schema.ts
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
fix: Give the sitemap only last-modified dates it can stand behind

Drops the changeFrequency and priority hints Google ignores, stops using an
initiative's end date as its modified date, and adds an optional `updated`
frontmatter date for initiatives and parts. Drafts are filtered defensively.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add lib/seo/sitemap.ts app/sitemap.ts lib/initiatives/schema.ts docs/initiatives.md tests/unit/seo-sitemap.test.mts && git commit -F "$MSG"
```

---

### Task 12: Verify the whole change and reconcile the spec

**Files:**

- Modify: `docs/superpowers/specs/2026-09-18-static-search-and-metadata-design.md`

- [ ] **Step 1: Run every check**

```bash
pnpm test
pnpm typecheck
git diff --name-only --diff-filter=d origin/main...HEAD -- '*.ts' '*.tsx' '*.mts' | xargs pnpm exec eslint
```

Expected: 62 tests pass, typecheck clean, eslint reports nothing.

- [ ] **Step 2: Build for production**

Run: `pnpm build`
Expected: the prebuild prints `Search index generated with 3 items` and `Pagefind index written to .../public/pagefind` (three items because every writing and initiative is a draft today), `next build` completes, and the route list includes `/search`, `/initiatives`, `/writings`, `/sitemap.xml`, and `/robots.txt`.

If the build fails on a `generateViewport` error under Cache Components, delete the `generateViewport` export from the failing initiative page (the per-initiative theme colour is a nicety), rebuild, and record the removal in the Task 9 follow-up commit. If it fails because Google Fonts cannot be fetched, that is a network issue unrelated to this change: say so, and rely on the dev-server checks from Tasks 4 and 7 to 9.

- [ ] **Step 3: Check the production output**

Start the production server as a background task (`PORT=3010 pnpm start`), then:

```bash
curl -s http://localhost:3010/robots.txt
curl -s http://localhost:3010/sitemap.xml
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3010/pagefind/pagefind.js
curl -s 'http://localhost:3010/api/search?q=writings'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3010/writings/project-superbloom
```

Expected:

- `robots.txt` lists `Google-Extended`, `ClaudeBot`, `Applebot-Extended`, and `meta-externalagent` with `Disallow: /writings/`, and ends with `Sitemap: https://willie.page/sitemap.xml`
- `sitemap.xml` lists only `/`, `/writings`, and `/initiatives` (every writing and initiative is a draft), with no `<changefreq>` or `<priority>` tags
- `200` for `pagefind.js`
- the search JSON has a result with `"path":"/writings"` and `"type":"page"`
- `404` for the draft post, because production hides drafts

- [ ] **Step 4: Check ⌘K on the production build**

In a browser at `http://localhost:3010/initiatives`, press Cmd+K (Ctrl+K off macOS), type `writings`, confirm a result linking to `/writings` appears, then press Esc. Do the same on `http://localhost:3010/`.

Stop the server task when done.

- [ ] **Step 5: Reconcile the spec with what was built**

In `docs/superpowers/specs/2026-09-18-static-search-and-metadata-design.md`, make these replacements.

Replace:

```
Static pages come from `STATIC_PAGES` in
`lib/entities/registry.ts`, which is exported so hover cards and search share
one list.
```

with:

```
Static pages come from `STATIC_PAGES` in
`lib/entities/pages.ts`, which `lib/entities/registry.ts` also imports, so
hover cards and search share one list.
```

Replace `to the warm tokens in `app/globals.css`.` with `to the warm tokens in `components/search/search.css`.`

Replace ``SiteSearch` shows no date for `UNDATED`.`` with ``SiteSearch` shows a date only for writings.``

Replace ``ProfilePage`, three `Organization`s`` with ``ProfilePage`; the `Person` lists the three ventures as `Organization`s under `worksFor```.

Replace:

```
Entities use stable `@id`s (`<origin>/#website`, `#person`, `#org-<key>`) so
pages reference one another rather than repeat.
```

with:

```
Entities use stable `@id`s (`<origin>/#website`, `#person`, `#org-<key>`).
A consumer resolves an `@id` only inside one document, so a page that
references the person includes the person node in its own graph.
```

Replace:

```
- `app/sitemap.ts`: remove `changeFrequency` and `priority` (Google ignores
  both).
```

with:

```
- `app/sitemap.ts` and `lib/seo/sitemap.ts`: a pure `buildSitemap()` builds the
  entries and `app/sitemap.ts` feeds it the loaders' data. Remove
  `changeFrequency` and `priority` (Google ignores both).
```

Replace ``Create: `lib/search/collect.ts`, `lib/search/pagefind.ts`,`` with ``Create: `lib/entities/pages.ts`, `lib/search/collect.ts`, `lib/search/pagefind.ts`, `components/search/search.css`, `lib/seo/sitemap.ts`,``.

Replace `the six new test files above.` with ``the new test files named in each Tests section, plus `tests/unit/search-server.test.mts` for `selectSearchable`.``

Replace `` `app/globals.css`, `tests/unit/search-rank.test.mts`.`` with `` `lib/initiatives/index.ts` (adds `loadAllInitiatives`), `tests/unit/search-rank.test.mts`.``

- [ ] **Step 6: Format and commit**

```bash
pnpm exec prettier --write docs/superpowers/specs/2026-09-18-static-search-and-metadata-design.md
MSG="$(git rev-parse --git-dir)/PLAN_COMMIT_MSG"
cat > "$MSG" <<'EOF'
chore(docs): Match the search and metadata spec to what was built

Records the static page list module, the search stylesheet, the pure sitemap
builder, and the self-contained JSON-LD graphs.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git restore --staged . && git add docs/superpowers/specs/2026-09-18-static-search-and-metadata-design.md && git commit -F "$MSG"
```

- [ ] **Step 7: Hand off**

Report to the user: the commits made, which Task 3 branch applied (emitted Component UI files or the npm fallback), whether `generateViewport` survived the production build, and what still needs a deployed URL: Google's Rich Results Test for the `Event` and `BlogPosting` markup, an Open Graph preview check, and confirming the `pagefind` binary installs on Vercel's Linux build. Nothing is pushed.
