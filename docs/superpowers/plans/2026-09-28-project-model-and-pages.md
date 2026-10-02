# Project Model and Project Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three places project data lives today with one validated MDX file per project, and give every visible project its own page at `/projects/<slug>`.

**Architecture:** Each project is `content/projects/<slug>.mdx`, validated by a zod schema in `lib/projects/schema.ts`. A pure loader (`lib/projects/load.ts`) reads the folder, resolves status from dates, checks parent and successor references, and drops hidden and draft projects. A cached wrapper (`lib/projects/index.ts`) serves Next.js. The page at `app/projects/[codename]` renders facts from frontmatter and Willie's write-up from the MDX body. It takes the project's Material 3 scheme from `lib/projects/brand.ts`. The `/projects` index stays parked until Willie picks a list layout on the [projects canvas](https://claude.ai/artifact/Xy4Dw99jGkf9F7oWDxERUT).

**Tech Stack:** Next.js 16 (App Router, Cache Components), zod 4, gray-matter, next-mdx-remote, date-fns 4, node:test run through tsx.

## Why

Willie wants every project to have a detail page that reflects on the work, not a line saying it existed. Older projects that have no surviving material, and work under NDA, are the exceptions: they show only the facts he can share. The current model cannot support that. Project data is split across `data/projects.json` (ten entries the page never reads), `content/projects/*.mdx` (Connie and ParliPro), and `content/projects/featured/connie.mdx` (a stale duplicate). Every entry also assumes one owner, one status, and one screenshot.

The schema below comes from a critique of the four canvas prototypes. It addresses these gaps:

- A project can belong to several organizations, or to none.
- A project can sit under a parent project.
- Willie can pin order with a weight.
- The page shows the roles he played.
- Media covers images, video, and documents.
- Status has more states than current and done.
- Visibility has three levels.
- A project can point at its initiative page and at the project it turned into.

## Decisions

The frontmatter fields, all validated by `ProjectFrontmatterSchema`, are:

| Field           | Type                                                                                                  | Meaning                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `title`         | string, required                                                                                      | The name exactly as Willie wrote it.                                                                                |
| `line`          | string                                                                                                | His one-line description. Missing means he has not written one, and the page shows nothing in its place.            |
| `owners`        | owner keys, default `[]`                                                                              | Keys from `lib/projects/owners.ts`. An empty list means the project is his own.                                     |
| `parent`        | slug                                                                                                  | The project this belongs under. The loader fails the build when the slug does not exist.                            |
| `initiative`    | slug                                                                                                  | The initiative page that tells this project's story. The page links to it.                                          |
| `successor`     | slug or `https://` URL                                                                                | What this project turned into.                                                                                      |
| `roles`         | strings, default `[]`                                                                                 | His roles, in his words ("Creator", "Product Manager").                                                             |
| `collaborators` | `{ name, href? }[]`                                                                                   | Credit for other people.                                                                                            |
| `starts`/`ends` | `YYYY-MM-DD`                                                                                          | Calendar dates, parsed with `DateSchema` from `lib/initiatives/schema.ts`.                                          |
| `updated`       | `YYYY-MM-DD`                                                                                          | The last real edit.                                                                                                 |
| `status`        | `planned`, `active`, `paused`, `complete`, `unreleased`, `handed-off`, `archived`                     | Derived from the dates when missing, as initiatives do.                                                             |
| `weight`        | integer 0–100, default 0                                                                              | Higher weights sort first; dates order the rest.                                                                    |
| `visibility`    | `public`, `facts`, `hidden`, default `public`                                                         | `facts` renders the header only, with no body and no media. `hidden` removes the project from every list and route. |
| `brand`         | seed key or `#rrggbb`                                                                                 | Overrides the scheme. Otherwise the scheme comes from the seed for the slug, then the first owner's seed.           |
| `website`       | `https://` URL                                                                                        | The project's own site.                                                                                             |
| `media`         | image `{ src, alt, decorative?, caption? }`, video `{ youtubeId, title }`, document `{ href, title }` | The first item is the hero.                                                                                         |
| `links`         | `{ href, label? }[]`                                                                                  | A link with no label shows its host and path, such as `github.com/WillieCubed/parlipro`.                            |
| `draft`         | boolean, default `false`                                                                              | Renders in development and returns 404 in production, as initiatives do.                                            |

A few decisions sit outside the schema:

- The slug is the file name. Files starting with `_` are skipped, which is how `_template.mdx` stays out.
- The loader rejects unknown keys, so a typo fails the build instead of being silently dropped.
- The detail route moves out of `app/_(pages)` to `app/projects/[codename]`. Every migrated project is marked `draft: true`, so nothing reaches production until Willie clears each draft flag himself.

I rejected three alternatives:

- **A single `kind` field** (product, program, event). The parent link already groups a product with its releases and a program with its events, and a kind field would be one more thing to keep in sync.
- **Keeping `data/projects.json` beside the MDX files.** Two sources for one list is how the current page ended up ignoring ten projects.
- **Leaving the detail route parked.** A parked folder never routes, so nobody could preview the page. Draft flags give the same protection in production and still allow a preview in development.

Some things are still open, and Willie has to answer them:

- The status of each older project is a best guess. The plan uses `unreleased` for ParliPro (his write-up says it "was never used in production"), `archived` for the old personal website, and `complete` for the rest.
- Nobody knows the start years of the eight older projects. `lastUpdated` in `data/projects.json` records when the entry was edited, not when the project ran, so the migration leaves those dates out.
- The ParliPro hero keeps the alt text main already carries in `thumbnailAlt`, copied exactly.
- The migration dropped seven dead or private links, listed in Task 4, Step 3.

## Global Constraints

- Every sentence of project content is Willie's own words. Migration copies text exactly, typos included ("parlimentary", "United Sates", "embarassed"). Where he has written nothing, the field stays empty. Never write, shorten, or reword a title, line, body, caption, or alt text.
- Images follow docs/accessibility.md, which `pnpm content:check` and the build enforce. An informative image needs nonblank alt text. A decorative image sets `decorative: true` with `alt: ''`, and its markup carries `aria-hidden`. Run `pnpm content:check` after touching project MDX or image markup.
- The only interface text the page adds is the status names in `STATUS_LABELS` and the link host labels from `linkLabel`.
- Nothing reaches willie.page without Willie's explicit go-ahead. Keep `/projects` parked (`routed: false` in `lib/site.ts`), and leave `draft: true` on every migrated file.
- The repository is ESM. Tests are `tests/unit/*.test.mts` using `node:test` and `node:assert/strict`, and `pnpm test` runs them.
- Brand colors follow docs/design-principles.md: neutral at rest, with the project's Material 3 Fidelity scheme on the page.
- Every in-site link goes through `SiteLink` (docs/links.md).
- Commits use Conventional Commits with a scope from docs/commits.md, a sentence-case subject, a why-body for anything non-trivial, and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never create merge commits.
- Bound builds on this machine. Run `pnpm build` alone, never beside another build or the dev server.

---

### Task 1: Owners and the project schema

**Files:**

- Create: `lib/projects/owners.ts`
- Create: `lib/projects/schema.ts`
- Modify: `scripts/image-alt-check.ts` (the frontmatter collections list)
- Test: `tests/unit/project-schema.test.mts`, `tests/unit/image-alt-check.test.mts`

**Interfaces:**

- Produces: `OWNERS`, `OWNER_KEYS`, `type OwnerKey`, `type Owner` from `owners.ts`. `ProjectFrontmatterSchema`, `ProjectStatusSchema`, `VisibilitySchema`, `ProjectMediaSchema`, and the types `ProjectFrontmatter`, `ProjectStatus`, `Visibility`, `ProjectMedia`, `Project` from `schema.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/project-schema.test.mts
import assert from 'node:assert/strict';
import test from 'node:test';

import { ProjectFrontmatterSchema } from '@/lib/projects/schema';

test('a title alone is a valid project with defaults', () => {
  const parsed = ProjectFrontmatterSchema.parse({ title: 'ParliPro' });
  assert.deepEqual(parsed.owners, []);
  assert.equal(parsed.weight, 0);
  assert.equal(parsed.visibility, 'public');
  assert.equal(parsed.draft, false);
  assert.deepEqual(parsed.media, []);
});

test('unknown keys fail instead of being dropped', () => {
  const result = ProjectFrontmatterSchema.safeParse({
    title: 'X',
    tagline: 'old field',
  });
  assert.equal(result.success, false);
});

test('owners must be known keys', () => {
  assert.equal(
    ProjectFrontmatterSchema.safeParse({ title: 'X', owners: ['lvbt'] })
      .success,
    true
  );
  assert.equal(
    ProjectFrontmatterSchema.safeParse({ title: 'X', owners: ['nobody'] })
      .success,
    false
  );
});

test('media is image, video, or document', () => {
  const parsed = ProjectFrontmatterSchema.parse({
    title: 'X',
    media: [
      { kind: 'image', src: '/a.webp', alt: 'A screenshot' },
      { kind: 'video', youtubeId: 'abc', title: 'A video' },
      { kind: 'document', href: '/report.pdf', title: 'A report' },
    ],
  });
  assert.equal(parsed.media.length, 3);
  assert.equal(
    ProjectFrontmatterSchema.safeParse({
      title: 'X',
      media: [{ kind: 'gif', src: '/a.gif' }],
    }).success,
    false
  );
});

test('an image needs a description unless it is marked decorative', () => {
  const image = (extra: object) =>
    ProjectFrontmatterSchema.safeParse({
      title: 'X',
      media: [{ kind: 'image', src: '/a.webp', ...extra }],
    }).success;
  assert.equal(image({ alt: '' }), false);
  assert.equal(image({ alt: '   ' }), false);
  assert.equal(image({ alt: '', decorative: true }), true);
  assert.equal(image({ alt: 'A screenshot', decorative: true }), false);
});

test('a website and a URL successor must be https', () => {
  assert.equal(
    ProjectFrontmatterSchema.safeParse({ title: 'X', website: 'http://x.com' })
      .success,
    false
  );
  assert.equal(
    ProjectFrontmatterSchema.safeParse({
      title: 'X',
      successor: 'https://x.com',
    }).success,
    true
  );
  assert.equal(
    ProjectFrontmatterSchema.safeParse({ title: 'X', successor: 'groundwork' })
      .success,
    true
  );
});

test('dates parse as local calendar days', () => {
  const parsed = ProjectFrontmatterSchema.parse({
    title: 'X',
    starts: '2023-01-09',
  });
  assert.equal(parsed.starts?.getDate(), 9);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test 2>&1 | grep -A3 project-schema`
Expected: FAIL, because `@/lib/projects/schema` cannot be found.

- [ ] **Step 3: Write the owners registry**

```ts
// lib/projects/owners.ts
/**
 * The organizations a project can belong to. A project lists these keys in
 * `owners`; a project with none is Willie's own. `brand` is a key in
 * lib/brand/seeds.json, and an owner without one keeps its projects neutral.
 */
export interface Owner {
  name: string;
  href?: string;
  brand?: string;
}

export const OWNERS = {
  lvbt: {
    name: 'Las Vegans for Better Transit',
    href: 'https://lasvegasfortransit.org/',
    brand: 'lvbt',
  },
  hypertext: {
    name: 'Hypertext Studio',
    href: 'https://hypertext.studio/',
    brand: 'hypertext',
  },
  rtc: {
    name: 'Reasonable Tech Company',
    href: 'https://reasonabletech.co/',
    brand: 'lovelace',
  },
  acm: { name: 'ACM UTD', href: 'https://github.com/acmutd' },
  asa: { name: 'American Society on Aging', href: 'https://www.asaging.org/' },
  nebula: { name: 'Nebula Labs', href: 'https://www.utdnebula.com/' },
  irvl: { name: 'IRVL', href: 'https://github.com/IRVLUTD' },
} as const satisfies Record<string, Owner>;

export type OwnerKey = keyof typeof OWNERS;

export const OWNER_KEYS = Object.keys(OWNERS) as [OwnerKey, ...OwnerKey[]];
```

- [ ] **Step 4: Write the schema**

```ts
// lib/projects/schema.ts
import { z } from 'zod';

import { imageAltIssue } from '@/lib/accessibility/alt-policy';
import { DateSchema } from '@/lib/initiatives/schema';

import { OWNER_KEYS } from './owners';

/**
 * Frontmatter for content/projects/<slug>.mdx. Every field a visitor reads
 * is Willie's own words; see docs/projects.md. Unknown keys fail the build
 * so a misspelled field cannot silently disappear.
 */

export const ProjectStatusSchema = z.enum([
  'planned',
  'active',
  'paused',
  'complete',
  'unreleased',
  'handed-off',
  'archived',
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const VisibilitySchema = z.enum(['public', 'facts', 'hidden']);
export type Visibility = z.infer<typeof VisibilitySchema>;

const HttpsSchema = z
  .string()
  .url()
  .regex(/^https:\/\//);
const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const ProjectMediaSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('image'),
      src: z.string().min(1),
      /** Willie's words, under the policy in docs/accessibility.md. */
      alt: z.string(),
      decorative: z.literal(true).optional(),
      caption: z.string().min(1).optional(),
    }),
    z.strictObject({
      kind: z.literal('video'),
      youtubeId: z.string().min(1),
      title: z.string().min(1),
    }),
    z.strictObject({
      kind: z.literal('document'),
      href: z.string().min(1),
      title: z.string().min(1),
    }),
  ])
  // The same policy the initiative schema and pnpm content:check apply.
  .superRefine((media, context) => {
    if (media.kind !== 'image') return;
    const message = imageAltIssue(media.alt, media.decorative === true);
    if (message) context.addIssue({ code: 'custom', path: ['alt'], message });
  });
export type ProjectMedia = z.infer<typeof ProjectMediaSchema>;

export const ProjectFrontmatterSchema = z.strictObject({
  title: z.string().min(1),
  line: z.string().min(1).optional(),
  owners: z.array(z.enum(OWNER_KEYS)).default([]),
  parent: SlugSchema.optional(),
  initiative: SlugSchema.optional(),
  successor: z.union([HttpsSchema, SlugSchema]).optional(),
  roles: z.array(z.string().min(1)).default([]),
  collaborators: z
    .array(
      z.strictObject({ name: z.string().min(1), href: HttpsSchema.optional() })
    )
    .default([]),
  starts: DateSchema.optional(),
  ends: DateSchema.optional(),
  updated: DateSchema.optional(),
  status: ProjectStatusSchema.optional(),
  weight: z.number().int().min(0).max(100).default(0),
  visibility: VisibilitySchema.default('public'),
  brand: z
    .string()
    .regex(/^(#[0-9a-fA-F]{6}|[a-z][a-z0-9-]*)$/)
    .optional(),
  website: HttpsSchema.optional(),
  media: z.array(ProjectMediaSchema).default([]),
  links: z
    .array(
      z.strictObject({
        href: z.string().min(1),
        label: z.string().min(1).optional(),
      })
    )
    .default([]),
  draft: z.boolean().default(false),
});
export type ProjectFrontmatter = z.infer<typeof ProjectFrontmatterSchema>;

export interface Project extends Omit<ProjectFrontmatter, 'status'> {
  /** The file name without `.mdx`, and the URL segment. */
  slug: string;
  /** Resolved from the dates when the frontmatter leaves it out. */
  status: ProjectStatus;
  /** The MDX body; always empty unless visibility is `public`. */
  content: string;
  /** Site-relative path of the project page. */
  href: string;
}
```

- [ ] **Step 5: Teach the content check about project media**

`pnpm content:check` validates image descriptions in frontmatter before every push and build, but it only knows the initiative and writing fields. Add a failing case to `tests/unit/image-alt-check.test.mts`:

```ts
test('project media images need descriptions; video and documents have none', () => {
  const source = `---
media:
  - kind: image
    src: /assets/projects/x.webp
    alt: ''
  - kind: video
    youtubeId: abc
    title: A video
  - kind: document
    href: /report.pdf
    title: A report
---`;
  const issues = validateMdxImageAlts('project.mdx', source);
  assert.equal(issues.length, 1);
  assert.ok(issues[0].message.startsWith('media[0]'));
});
```

Run it and watch it fail with 0 issues found. Then add `'media'` to the frontmatter collections in `validateMdxImageAlts` in `scripts/image-alt-check.ts`:

```ts
  for (const collection of ['gallery', 'images', 'scenes', 'media']) {
```

`mediaAlt` already skips entries with no `src`, `url`, or `imageUrl`, so video and document entries pass untouched.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test 2>&1 | grep -E "project-schema|image-alt-check|^# (pass|fail)"`
Expected: every project-schema and image-alt-check test passes, and the fail count is 0.

Run: `pnpm content:check`
Expected: `Image alt check passed.`

- [ ] **Step 7: Commit**

```bash
git add lib/projects/owners.ts lib/projects/schema.ts tests/unit/project-schema.test.mts scripts/image-alt-check.ts tests/unit/image-alt-check.test.mts
git commit -m "feat(projects): Add a project schema with owners, roles, and visibility

Project data lives in three places today and assumes one owner, one
status, and one screenshot. The new schema lets a project belong to
several organizations or a parent project, carry Willie's roles,
choose image, video, or document media, pin its order with a weight,
and show everything, only facts, or nothing.

Unknown keys fail the build so a misspelled field cannot vanish, and
image media follows the same description policy as initiatives, in
the schema and in pnpm content:check.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The loader, the cached wrapper, and the callers that break

**Files:**

- Create: `lib/projects/load.ts`
- Create: `lib/projects/index.ts`
- Delete: `lib/projects.ts`
- Modify: `app/_(pages)/projects/page.tsx` (parked; rewritten to the new API)
- Modify: `app/_(pages)/research/page.tsx` (parked; new API)
- Delete: `app/_(pages)/projects/[codename]/` (Task 5 replaces it), `app/_(pages)/projects/layout.tsx`, `components/projects/FeatureList.tsx`, `components/projects/ProjectBackIcon.tsx`, `components/projects/ProjectNextIcon.tsx`, `lib/common.ts`
- Create: `tests/fixtures/projects/alpha.mdx`, `beta.mdx`, `facts.mdx`, `hidden.mdx`, `draft.mdx`, `_template.mdx`
- Test: `tests/unit/project-load.test.mts`

**Interfaces:**

- Consumes: `ProjectFrontmatterSchema`, `Project`, `ProjectStatus` from Task 1.
- Produces: `loadAllProjects(options?: { dir?: string; includeDrafts?: boolean; now?: Date }): Project[]`, `projectStatus(explicit, starts, ends, now): ProjectStatus`, `sortProjects(projects: Project[]): Project[]`, `childrenOf(projects: Project[], slug: string): Project[]`, and `PROJECTS_DIR` from `load.ts`. From `index.ts`: `getProjects(): Promise<Project[]>`, `getProject(slug): Promise<Project | null>`, and `getProjectSlugs(): Promise<string[]>`, plus re-exports of `load.ts`, `schema.ts`, and `owners.ts`.

- [ ] **Step 1: Write the fixtures**

`tests/fixtures/projects/alpha.mdx`:

```mdx
---
title: Alpha
line: The parent project.
owners: [lvbt]
starts: 2026-01-01
weight: 50
---

Alpha's body.
```

`tests/fixtures/projects/beta.mdx`:

```mdx
---
title: Beta
parent: alpha
starts: 2026-06-01
ends: 2026-06-30
---
```

`tests/fixtures/projects/facts.mdx`:

```mdx
---
title: Facts Only
visibility: facts
media:
  - kind: image
    src: /secret.webp
    alt: A screenshot that must never render
---

This body must never render.
```

`tests/fixtures/projects/hidden.mdx`:

```mdx
---
title: Hidden
visibility: hidden
---
```

`tests/fixtures/projects/draft.mdx`:

```mdx
---
title: Draft
draft: true
---
```

`tests/fixtures/projects/_template.mdx`:

```mdx
---
this: would fail the schema if the loader read it
---
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/unit/project-load.test.mts
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  childrenOf,
  loadAllProjects,
  projectStatus,
} from '@/lib/projects/load';

const dir = 'tests/fixtures/projects';
const now = new Date(2026, 8, 28);

test('hidden projects and drafts are left out by default', () => {
  const slugs = loadAllProjects({ dir, now }).map((p) => p.slug);
  assert.deepEqual(slugs.sort(), ['alpha', 'beta', 'facts']);
});

test('drafts are included on request, hidden projects never are', () => {
  const slugs = loadAllProjects({ dir, now, includeDrafts: true }).map(
    (p) => p.slug
  );
  assert.ok(slugs.includes('draft'));
  assert.ok(!slugs.includes('hidden'));
});

test('weight sorts first, then the latest start', () => {
  const slugs = loadAllProjects({ dir, now }).map((p) => p.slug);
  assert.equal(slugs[0], 'alpha');
  assert.equal(slugs[1], 'beta');
});

test('a facts-only project has no body', () => {
  const facts = loadAllProjects({ dir, now }).find((p) => p.slug === 'facts');
  assert.equal(facts?.content, '');
});

test('children are found by parent slug', () => {
  const all = loadAllProjects({ dir, now });
  assert.deepEqual(
    childrenOf(all, 'alpha').map((p) => p.slug),
    ['beta']
  );
});

test('status comes from the dates when missing', () => {
  const all = loadAllProjects({ dir, now });
  assert.equal(all.find((p) => p.slug === 'alpha')?.status, 'active');
  assert.equal(all.find((p) => p.slug === 'beta')?.status, 'complete');
  assert.equal(
    projectStatus(undefined, new Date(2027, 0, 1), undefined, now),
    'planned'
  );
  assert.equal(
    projectStatus('unreleased', undefined, undefined, now),
    'unreleased'
  );
});

test('an unknown parent fails loudly', () => {
  const temp = mkdtempSync(join(tmpdir(), 'projects-'));
  writeFileSync(
    join(temp, 'orphan.mdx'),
    '---\ntitle: Orphan\nparent: nobody\n---\n'
  );
  assert.throws(() => loadAllProjects({ dir: temp, now }), /parent "nobody"/);
});

test('an unknown successor slug fails loudly', () => {
  const temp = mkdtempSync(join(tmpdir(), 'projects-'));
  writeFileSync(
    join(temp, 'old.mdx'),
    '---\ntitle: Old\nsuccessor: nobody\n---\n'
  );
  assert.throws(
    () => loadAllProjects({ dir: temp, now }),
    /successor "nobody"/
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test 2>&1 | grep -A3 project-load`
Expected: FAIL, because `@/lib/projects/load` cannot be found.

- [ ] **Step 4: Write the loader**

```ts
// lib/projects/load.ts
import matter from 'gray-matter';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  type Project,
  ProjectFrontmatterSchema,
  type ProjectStatus,
} from './schema';

/**
 * Reads content/projects with no Next.js cache involved, so tests and
 * build scripts can call it under plain Node. Pages use lib/projects.
 */

export const PROJECTS_DIR = join(process.cwd(), 'content', 'projects');
const HIDDEN_PREFIX = '_';

export function projectStatus(
  explicit: ProjectStatus | undefined,
  starts: Date | undefined,
  ends: Date | undefined,
  now: Date
): ProjectStatus {
  if (explicit) return explicit;
  if (starts && now < starts) return 'planned';
  if (ends && now > endOfDay(ends)) return 'complete';
  if (starts) return 'active';
  return 'planned';
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function readProject(filePath: string, slug: string, now: Date): Project {
  const { data, content } = matter(readFileSync(filePath, 'utf8'));
  const parsed = ProjectFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid project frontmatter in ${filePath}:\n${parsed.error.message}`
    );
  }
  const { status, ...rest } = parsed.data;
  return {
    ...rest,
    slug,
    status: projectStatus(status, rest.starts, rest.ends, now),
    // A facts-only project never carries its body past the loader, so no
    // page or feed can render it by accident.
    content: rest.visibility === 'public' ? content.trim() : '',
    href: `/projects/${slug}`,
  };
}

const time = (date?: Date) => (date ? date.getTime() : Number.MIN_SAFE_INTEGER);

/** Pinned work first, then the most recent start, undated last, then by title. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) =>
      b.weight - a.weight ||
      time(b.starts) - time(a.starts) ||
      a.title.localeCompare(b.title)
  );
}

export function childrenOf(projects: Project[], slug: string): Project[] {
  return projects.filter((project) => project.parent === slug);
}

export interface LoadOptions {
  dir?: string;
  includeDrafts?: boolean;
  now?: Date;
}

export function loadAllProjects({
  dir = PROJECTS_DIR,
  includeDrafts = false,
  now = new Date(),
}: LoadOptions = {}): Project[] {
  if (!existsSync(dir)) return [];
  const all = readdirSync(dir)
    .filter((file) => file.endsWith('.mdx') && !file.startsWith(HIDDEN_PREFIX))
    .map((file) =>
      readProject(join(dir, file), file.replace(/\.mdx$/, ''), now)
    );
  // References are checked against every file, hidden and draft included,
  // so hiding a parent never breaks the build of its children.
  const slugs = new Set(all.map((project) => project.slug));
  for (const project of all) {
    if (
      project.parent &&
      (project.parent === project.slug || !slugs.has(project.parent))
    ) {
      throw new Error(
        `Project "${project.slug}" names a parent "${project.parent}" that does not exist.`
      );
    }
    if (
      project.successor &&
      !project.successor.startsWith('https://') &&
      !slugs.has(project.successor)
    ) {
      throw new Error(
        `Project "${project.slug}" names a successor "${project.successor}" that does not exist.`
      );
    }
  }
  return sortProjects(
    all.filter(
      (project) =>
        project.visibility !== 'hidden' && (includeDrafts || !project.draft)
    )
  );
}
```

- [ ] **Step 5: Write the cached wrapper and delete the old module**

```ts
// lib/projects/index.ts
import { cacheLife } from 'next/cache';

import { showDrafts } from '@/lib/drafts';

import { loadAllProjects } from './load';
import type { Project } from './schema';

export * from './load';
export * from './owners';
export * from './schema';

/** Every visible project, drafts included only in development. */
export async function getProjects(): Promise<Project[]> {
  'use cache';
  cacheLife('hours');
  return loadAllProjects({ includeDrafts: showDrafts });
}

export async function getProject(slug: string): Promise<Project | null> {
  return (await getProjects()).find((project) => project.slug === slug) ?? null;
}

export async function getProjectSlugs(): Promise<string[]> {
  return (await getProjects()).map((project) => project.slug);
}
```

Run: `git rm lib/projects.ts`

- [ ] **Step 6: Rewrite the two parked callers against the new API**

The parked index gets replaced when Willie picks a list layout. Until then it only has to compile, so it becomes a plain list.

```tsx
// app/_(pages)/projects/page.tsx
import SiteLink from '@/components/link/SiteLink';

import { getProjects } from '@/lib/projects';
import { pageMetadata } from '@/lib/site';

export async function generateMetadata() {
  return pageMetadata({
    title: 'Projects',
    description: 'Apps and other things Willie has built.',
    path: '/projects',
  });
}

/**
 * Parked until Willie picks a list layout on the projects canvas. It only
 * has to compile against lib/projects in the meantime.
 */
export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <main className="mx-auto max-w-[840px] px-5 py-16">
      <h1 className="text-display-small">Projects</h1>
      <ol className="mt-8 space-y-4">
        {projects.map((project) => (
          <li key={project.slug}>
            <SiteLink href={project.href}>{project.title}</SiteLink>
          </li>
        ))}
      </ol>
    </main>
  );
}
```

The description string above is the one `lib/site.ts` already carries for `/projects` in `sitePages`, so it is not new copy.

In `app/_(pages)/research/page.tsx`, replace the `ProjectData` import and `getAllProjects` with the new API. Keep the three research projects the old `type: research` flag picked:

```tsx
import type { Project } from '@/lib/projects';
import { getProjects } from '@/lib/projects';

/** The projects data/projects.json typed as research before the migration. */
const RESEARCH_SLUGS = ['cole', 'storygen', 'aggie'];

type ProjectsPageProps = {
  researchProjects: Project[];
};

async function getResearchPageData(): Promise<ProjectsPageProps> {
  const projects = await getProjects();
  return {
    researchProjects: projects.filter(({ slug }) =>
      RESEARCH_SLUGS.includes(slug)
    ),
  };
}
```

The page reads no other project fields, so nothing else in it changes.

Remove the old detail route and everything only it used. Task 5 builds the replacement outside `app/_(pages)`:

```bash
git rm -r "app/_(pages)/projects/[codename]" "app/_(pages)/projects/layout.tsx"
git rm components/projects/FeatureList.tsx components/projects/ProjectBackIcon.tsx components/projects/ProjectNextIcon.tsx lib/common.ts
grep -rn "lib/common\|FeatureList\|ProjectBackIcon\|ProjectNextIcon" app components lib
```

Expected: the grep prints nothing.

- [ ] **Step 7: Run the tests and the typecheck**

Run: `pnpm test 2>&1 | grep -E "project-(load|schema)|^# (pass|fail)"`
Expected: all project tests pass.

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add lib tests/unit/project-load.test.mts tests/fixtures/projects "app/_(pages)" components/projects
git commit -m "feat(projects): Load projects from one validated folder

The loader reads content/projects, resolves status from dates the way
initiatives do, sorts pinned work first, and fails the build on a
parent or successor that does not exist. A facts-only project drops
its body at the loader so nothing downstream can render it.

The pure loader stays free of next/cache so tests and scripts can call
it under plain Node; pages go through the cached wrapper.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Page helpers and the brand seed

**Files:**

- Create: `lib/projects/facts.ts`
- Create: `lib/projects/brand.ts`
- Test: `tests/unit/project-facts.test.mts`

**Interfaces:**

- Consumes: `Project`, `ProjectStatus` (Task 1), `OWNERS` (Task 1), `brandSeeds` from `lib/brand/scheme.ts`.
- Produces: `STATUS_LABELS: Record<ProjectStatus, string>`, `projectYears(p: Pick<Project, 'starts' | 'ends' | 'status'>): string | undefined`, `projectFacts(p: Project): string[]`, and `linkLabel(href: string): string` from `facts.ts`. From `brand.ts`: `projectSeed(p: Pick<Project, 'slug' | 'brand' | 'owners'>, table?: Record<string, { hex: string }>): string | undefined`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/project-facts.test.mts
import assert from 'node:assert/strict';
import test from 'node:test';

import { projectSeed } from '@/lib/projects/brand';
import { linkLabel, projectFacts, projectYears } from '@/lib/projects/facts';
import type { Project } from '@/lib/projects/schema';

const base: Project = {
  slug: 'parlipro',
  href: '/projects/parlipro',
  title: 'ParliPro',
  owners: [],
  roles: ['Creator', 'Lead Developer'],
  collaborators: [],
  weight: 0,
  visibility: 'public',
  media: [],
  links: [],
  draft: false,
  status: 'unreleased',
  starts: new Date(2023, 0, 9),
  content: '',
};

test('years collapse to one, span two, or stay open while active', () => {
  assert.equal(projectYears(base), '2023');
  assert.equal(
    projectYears({ ...base, ends: new Date(2024, 3, 1) }),
    '2023–2024'
  );
  assert.equal(projectYears({ ...base, status: 'active' }), '2023–');
  assert.equal(projectYears({ ...base, starts: undefined }), undefined);
});

test('facts read roles, owners, years, then status', () => {
  assert.deepEqual(projectFacts(base), [
    'Creator',
    'Lead Developer',
    '2023',
    'Unreleased',
  ]);
  assert.deepEqual(
    projectFacts({ ...base, roles: [], owners: ['asa'], status: 'complete' }),
    ['American Society on Aging', '2023', 'Complete']
  );
});

test('an unlabeled link shows its host and path', () => {
  assert.equal(
    linkLabel('https://github.com/WillieCubed/parlipro'),
    'github.com/WillieCubed/parlipro'
  );
  assert.equal(
    linkLabel('https://parlipro.vercel.app/'),
    'parlipro.vercel.app'
  );
  assert.equal(linkLabel('https://www.asaging.org/'), 'asaging.org');
});

test('the seed is the project brand, then its slug, then its first owner', () => {
  const table = { lvbt: { hex: '#e5471a' }, parlipro: { hex: '#cc8888' } };
  assert.equal(
    projectSeed({ slug: 'x', brand: '#123456', owners: [] }, table),
    '#123456'
  );
  assert.equal(
    projectSeed({ slug: 'x', brand: 'lvbt', owners: [] }, table),
    '#e5471a'
  );
  assert.equal(projectSeed({ slug: 'parlipro', owners: [] }, table), '#cc8888');
  assert.equal(
    projectSeed({ slug: 'x', owners: ['acm', 'lvbt'] }, table),
    '#e5471a'
  );
  assert.equal(projectSeed({ slug: 'x', owners: [] }, table), undefined);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test 2>&1 | grep -A3 project-facts`
Expected: FAIL, because `@/lib/projects/facts` cannot be found.

- [ ] **Step 3: Write the helpers**

```ts
// lib/projects/facts.ts
import { format } from 'date-fns';

import { OWNERS } from './owners';
import type { Project, ProjectStatus } from './schema';

/**
 * The only interface words a project page adds, mirroring the statuses
 * Willie uses in Docket. Everything else on the page is his.
 */
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  paused: 'Paused',
  complete: 'Complete',
  unreleased: 'Unreleased',
  'handed-off': 'Handed off',
  archived: 'Archived',
};

const OPEN: ProjectStatus[] = ['planned', 'active', 'paused'];

export function projectYears(
  project: Pick<Project, 'starts' | 'ends' | 'status'>
): string | undefined {
  const from = project.starts ? format(project.starts, 'yyyy') : undefined;
  const to = project.ends ? format(project.ends, 'yyyy') : undefined;
  if (from && to) return from === to ? from : `${from}–${to}`;
  if (from) return OPEN.includes(project.status) ? `${from}–` : from;
  return to;
}

export function projectFacts(project: Project): string[] {
  const years = projectYears(project);
  return [
    ...project.roles,
    ...project.owners.map((key) => OWNERS[key].name),
    ...(years ? [years] : []),
    STATUS_LABELS[project.status],
  ];
}

/** Host and path, so an unlabeled link names where it goes without new copy. */
export function linkLabel(href: string): string {
  try {
    const url = new URL(href);
    return `${url.host}${url.pathname}`
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  } catch {
    return href;
  }
}
```

```ts
// lib/projects/brand.ts
import { brandSeeds } from '@/lib/brand/scheme';

import { OWNERS } from './owners';
import type { Project } from './schema';

type SeedTable = Record<string, { hex: string } | undefined>;

/**
 * The `#rrggbb` a project page builds its Material 3 scheme from: the
 * project's own `brand`, then a seed the resolver found on the project's
 * own site (keyed by slug), then its first owner that has one. Without
 * any of those the page stays neutral.
 */
export function projectSeed(
  project: Pick<Project, 'slug' | 'brand' | 'owners'>,
  table: SeedTable = brandSeeds as SeedTable
): string | undefined {
  const fromKey = (key?: string) =>
    key?.startsWith('#') ? key : key ? table[key]?.hex : undefined;
  const ownerKey = project.owners
    .map((owner) => (OWNERS[owner] as { brand?: string }).brand)
    .find((brand) => brand && table[brand]);
  return (
    fromKey(project.brand) ?? table[project.slug]?.hex ?? fromKey(ownerKey)
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test 2>&1 | grep -E "project-facts|^# (pass|fail)"`
Expected: all project-facts tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/projects/facts.ts lib/projects/brand.ts tests/unit/project-facts.test.mts
git commit -m "feat(projects): Derive a project's facts line and brand seed

The facts line is built only from Willie's own data: roles, owners,
years, and a status word that mirrors his Docket vocabulary. Unlabeled
links show their host and path instead of invented button copy.

The seed prefers the project's own site over its owner, so a project
like lvwwd.org can differ from LVBT's orange.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Migrate the existing projects verbatim

**Files:**

- Create: `content/projects/{cole,hackportal,storygen,aggie,yearbook,comet-planning,utd-guide,orbit,website}.mdx`
- Modify: `content/projects/connie.mdx`, `content/projects/parlipro.mdx`, `content/projects/_template.mdx`
- Delete: `data/projects.json`, `content/projects/featured/connie.mdx`
- Test: `tests/unit/project-content.test.mts`

**Interfaces:**

- Consumes: `loadAllProjects` (Task 2), `ProjectFrontmatterSchema` (Task 1).
- Produces: eleven project files, each `draft: true`.

- [ ] **Step 1: Write the failing verbatim test**

The expected strings below are copied from `data/projects.json` and the two MDX files before the migration. The test keeps anyone from rewording them later.

```ts
// tests/unit/project-content.test.mts
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadAllProjects } from '@/lib/projects/load';

const projects = loadAllProjects({ includeDrafts: true });
const bySlug = new Map(projects.map((p) => [p.slug, p]));

/** Willie's own lines, exactly as he wrote them before the migration. */
const LINES: Record<string, string> = {
  cole: 'The concept learning project aims to learn domain-agnostic representations of knowledge in the form of reusable abstract concepts.',
  hackportal:
    'HackPortal is a hackathon management platform built for small and large events.',
  storygen:
    'Storygen is a tool that uses large language models and knowledge graphs to generate complex stories with characters.',
  aggie:
    'Aggie is a testbench for building intelligent agents that are modular and explainable.',
  yearbook:
    'UTD Wrapped is a yearbook for the 21st century inspired by Spotify Wrapped.',
  'comet-planning':
    'Nebula Planner is an interactive tool that lets students plan their college coursework and experiences in an intuitive drag-and-drop interface.',
  'utd-guide':
    'The UTD Survival Guide is a personalizable guide built to fit the needs of a diverse student body.',
  orbit:
    'Orbit lets introverts (and others!) find people to pull into their orbits using a fun and unique matching experience based on responses to questions, not looks.',
  website:
    'This is my personal portfolio and the hub to who I am and what I do.',
  connie:
    'A communications dashboard that connects nonprofits to older adults.',
  parlipro: 'Presiding over meetings with parlimentary procedure, done simply.',
};

test('every migrated project parses and keeps its line verbatim', () => {
  for (const [slug, line] of Object.entries(LINES)) {
    assert.equal(bySlug.get(slug)?.line, line, slug);
  }
});

test('the two write-ups keep their bodies', () => {
  assert.match(
    bySlug.get('parlipro')?.content ?? '',
    /kept having nightmares \(\/s\)/
  );
  assert.match(
    bySlug.get('connie')?.content ?? '',
    /In the United Sates, older adults/
  );
});

test('the ParliPro hero keeps the description main already carried', () => {
  const hero = bySlug.get('parlipro')?.media[0];
  assert.equal(
    hero?.kind === 'image' ? hero.alt : undefined,
    'ParliPro project graphic showing a meeting in progress'
  );
});

test('nothing migrated is published without Willie clearing the draft flag', () => {
  for (const slug of Object.keys(LINES))
    assert.equal(bySlug.get(slug)?.draft, true, slug);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test 2>&1 | grep -A5 project-content`
Expected: FAIL. `connie.mdx` and `parlipro.mdx` still use the old fields, which the strict schema rejects.

- [ ] **Step 3: Write the eleven project files**

The migration drops these links because they are dead or point at private repositories. Record them in the commit body so Willie can restore any he wants:

- `https://hackportal.hackutd.co`, which no longer resolves
- `https://guide.utdnebula.com`, which no longer resolves
- `https://aggie.williecubed.dev`, which no longer resolves
- `https://irvlutd.github.io/concept-learner`, which returns 404 (it was listed for both CoLe and Storygen)
- `https://github.com/WillieCubed/orbit-app`, which is private
- `https://github.com/WillieCubed/aggie`, which is private
- `https://github.com/IRVLUTD/concept-learner`, which is private

The Nebula Planner repository was recorded as `UTDNebula/neubla-planner`. That's a typo, and the repository is `UTDNebula/planner`.

`content/projects/cole.mdx`:

```mdx
---
title: 'CoLe: The Concept Learning Project'
line: The concept learning project aims to learn domain-agnostic representations of knowledge in the form of reusable abstract concepts.
owners: [irvl]
status: complete
draft: true
---
```

`content/projects/hackportal.mdx`:

```mdx
---
title: HackPortal
line: HackPortal is a hackathon management platform built for small and large events.
owners: [acm]
status: complete
links:
  - href: https://github.com/acmutd/hackportal
draft: true
---
```

`content/projects/storygen.mdx`:

```mdx
---
title: Storygen
line: Storygen is a tool that uses large language models and knowledge graphs to generate complex stories with characters.
owners: [irvl]
status: complete
draft: true
---
```

`content/projects/aggie.mdx`:

```mdx
---
title: 'Aggie: A Testbed for Intelligent Agents'
line: Aggie is a testbench for building intelligent agents that are modular and explainable.
status: complete
draft: true
---
```

`content/projects/yearbook.mdx`:

```mdx
---
title: UTD Wrapped
line: UTD Wrapped is a yearbook for the 21st century inspired by Spotify Wrapped.
status: complete
links:
  - href: https://github.com/WillieCubed/yearbook
draft: true
---
```

`content/projects/comet-planning.mdx`:

```mdx
---
title: Nebula Planner
line: Nebula Planner is an interactive tool that lets students plan their college coursework and experiences in an intuitive drag-and-drop interface.
owners: [nebula]
status: complete
links:
  - href: https://github.com/UTDNebula/planner
draft: true
---
```

`content/projects/utd-guide.mdx`:

```mdx
---
title: UTD Survival Guide
line: The UTD Survival Guide is a personalizable guide built to fit the needs of a diverse student body.
owners: [nebula]
status: complete
links:
  - href: https://github.com/UTDNebula/survival-guide
draft: true
---
```

`content/projects/orbit.mdx`:

```mdx
---
title: 'Orbit: A Friend-Finding App'
line: Orbit lets introverts (and others!) find people to pull into their orbits using a fun and unique matching experience based on responses to questions, not looks.
status: complete
draft: true
---
```

`content/projects/website.mdx`:

```mdx
---
title: Personal Website
line: This is my personal portfolio and the hub to who I am and what I do.
status: archived
links:
  - href: https://github.com/WillieCubed/website
draft: true
---
```

Replace the frontmatter of `content/projects/connie.mdx`, and keep its body from `# Overview` down unchanged:

```yaml
---
title: Connie Phase II
line: 'A communications dashboard that connects nonprofits to older adults.'
owners: [asa]
roles: ['Product Manager']
starts: 2024-02-22
status: complete
links:
  - href: https://github.com/ConnieML/Connie-RTC
    label: 'Project Repository'
draft: true
---
```

Replace the frontmatter of `content/projects/parlipro.mdx`, and keep its body from `# Overview` down unchanged, including the companion-view image and its alt text:

```yaml
---
title: ParliPro
line: 'Presiding over meetings with parlimentary procedure, done simply.'
roles: [Creator, Lead Developer]
starts: 2023-01-09
status: unreleased
website: https://parlipro.vercel.app/
media:
  - kind: image
    src: /assets/projects/parlipro/project-hero-graphic.webp
    alt: ParliPro project graphic showing a meeting in progress
links:
  - href: https://github.com/WillieCubed/parlipro
    label: Client-side Code
  - href: https://parlipro.vercel.app/
    label: ParliPro Web App
draft: true
---
```

Replace `content/projects/_template.mdx` with a commented template. The loader skips it because of its `_` prefix:

```mdx
---
# Copy to content/projects/<slug>.mdx. Every sentence must be Willie's own
# words; leave a field out rather than write it for him. docs/projects.md
# explains each field.
title: ''
line: ''
owners: []
roles: []
starts: 2026-01-01
visibility: public
draft: true
---
```

Then remove the old sources:

```bash
git rm data/projects.json content/projects/featured/connie.mdx
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test 2>&1 | grep -E "project-|^# (pass|fail)"`
Expected: every project test passes.

- [ ] **Step 5: Commit**

```bash
git add content/projects data tests/unit/project-content.test.mts
git commit -m "chore(content): Move every project into one validated folder

The ten entries in data/projects.json were never read by the page, and
featured/connie.mdx duplicated connie.mdx. All eleven projects now
live in content/projects with their text copied verbatim; a test pins
each line so nobody rewords Willie's writing later.

Every file is a draft until Willie clears the flag himself. Statuses
for the older projects are best guesses for him to confirm. Their
start years are unknown, because lastUpdated recorded edits rather
than when the work ran, so they are left out.

Dropped as dead or private: hackportal.hackutd.co,
guide.utdnebula.com, aggie.williecubed.dev,
irvlutd.github.io/concept-learner, and the private repos orbit-app,
aggie, and IRVLUTD/concept-learner. The Nebula Planner repo URL had a
typo (neubla-planner) and now points at UTDNebula/planner.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The project page

**Files:**

- Create: `app/projects/[codename]/page.tsx`
- Create: `app/projects/[codename]/opengraph-image.tsx`
- Create: `components/projects/ProjectPage.tsx`
- Create: `components/projects/ProjectMedia.tsx`
- Create: `components/projects/project-page.css`
- Test: `tests/e2e/project-pages.spec.mts` (production gate), `tests/e2e/project-drafts.spec.mts` (dev server only)

**Interfaces:**

- Consumes: `getProjects`, `childrenOf`, and `Project` (Task 2). `projectFacts`, `linkLabel`, and `projectSeed` (Task 3). `getInitiative` from `lib/initiatives`. `schemeStyleFromHex` from `lib/initiatives/theme.ts`. `TopBar`, `SiteLink`, and `YouTubeEmbed`. `InitiativeBody` renders the MDX body.
- Produces: the route `/projects/<slug>`.

- [ ] **Step 1: Write the end-to-end tests**

`playwright.config.mts` runs against a production build (`pnpm start`), where every draft returns 404. So there are two specs. The production spec guards the publishing gate. The draft spec checks the page content, and it only runs when `DRAFTS_BASE_URL` points at the dev server.

```ts
// tests/e2e/project-pages.spec.mts
import { expect, test } from '@playwright/test';

// Every project is a draft until Willie clears the flag himself. When he
// publishes one, move its slug out of this list in the same commit.
const DRAFTS = ['parlipro', 'hackportal', 'connie'];

test('draft project pages are not served in production', async ({ page }) => {
  for (const slug of DRAFTS) {
    const response = await page.goto(`/projects/${slug}`);
    expect(response?.status(), slug).toBe(404);
  }
});
```

```ts
// tests/e2e/project-drafts.spec.mts
import { expect, test } from '@playwright/test';

const base = process.env.DRAFTS_BASE_URL;
test.skip(
  !base,
  'Drafts render only on the dev server; set DRAFTS_BASE_URL to run.'
);
test.use({ baseURL: base });

test('ParliPro shows its facts, links, and full write-up', async ({ page }) => {
  await page.goto('/projects/parlipro');
  await expect(
    page.getByRole('heading', { level: 1, name: 'ParliPro' })
  ).toBeVisible();
  await expect(
    page.getByText(
      'Presiding over meetings with parlimentary procedure, done simply.'
    )
  ).toBeVisible();
  await expect(page.getByText('Unreleased')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'ParliPro Web App' })
  ).toBeVisible();
  await expect(page.getByText('kept having nightmares (/s)')).toBeVisible();
});

test('a project without a write-up shows only its facts', async ({ page }) => {
  await page.goto('/projects/hackportal');
  await expect(
    page.getByRole('heading', { level: 1, name: 'HackPortal' })
  ).toBeVisible();
  await expect(page.getByText('ACM UTD')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'github.com/acmutd/hackportal' })
  ).toBeVisible();
});

test('an unknown project is a 404', async ({ page }) => {
  const response = await page.goto('/projects/not-a-project');
  expect(response?.status()).toBe(404);
});
```

- [ ] **Step 2: Run the draft spec to verify it fails**

Start the dev server with the Browser pane's `preview_start` and the `web` configuration, which serves port 3000.

Run: `DRAFTS_BASE_URL=http://localhost:3000 pnpm exec playwright test tests/e2e/project-drafts.spec.mts --project=desktop --workers=1`
Expected: FAIL, because the route still returns 404.

- [ ] **Step 3: Write the media component**

```tsx
// components/projects/ProjectMedia.tsx
import SiteLink from '@/components/link/SiteLink';
import YouTubeEmbed from '@/components/mdx/YouTubeEmbed';

import type { ProjectMedia as Media } from '@/lib/projects';

/** One piece of a project's media. The first item on a page is the hero. */
export default function ProjectMedia({
  media,
  hero = false,
}: {
  media: Media;
  hero?: boolean;
}) {
  const className = hero ? 'project-hero' : 'project-figure';
  switch (media.kind) {
    case 'image':
      return (
        <figure className={className}>
          {/* Project captures come in any size, so they are laid out by CSS
              rather than given fixed next/image dimensions. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.src}
            alt={media.alt}
            aria-hidden={media.decorative ? true : undefined}
          />
          {media.caption && <figcaption>{media.caption}</figcaption>}
        </figure>
      );
    case 'video':
      return (
        <div className={className}>
          <YouTubeEmbed videoId={media.youtubeId} title={media.title} />
        </div>
      );
    case 'document':
      return (
        <SiteLink className="project-document" href={media.href}>
          {media.title}
        </SiteLink>
      );
  }
}
```

- [ ] **Step 4: Write the page component and its styles**

```tsx
// components/projects/ProjectPage.tsx
import InitiativeBody from '@/components/initiatives/InitiativeBody';
import SiteLink from '@/components/link/SiteLink';
import TopBar from '@/components/site/TopBar';

import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import type { Project } from '@/lib/projects';
import { projectSeed } from '@/lib/projects/brand';
import { linkLabel, projectFacts } from '@/lib/projects/facts';

import ProjectMedia from './ProjectMedia';
import './project-page.css';

interface ProjectPageProps {
  project: Project;
  parent: Project | null;
  childProjects: Project[];
  successor: Project | null;
  initiative: { title: string; href: string } | null;
}

/**
 * A project's own page: the facts Willie recorded, then his write-up. A
 * facts-only project reaches here with no body and no media, so the page
 * shows just the header.
 */
export default function ProjectPage({
  project,
  parent,
  childProjects,
  successor,
  initiative,
}: ProjectPageProps) {
  const crumbs = [
    { label: 'Projects', href: '/projects' },
    ...(parent ? [{ label: parent.title, href: parent.href }] : []),
    { label: project.title, href: project.href },
  ];
  const [hero, ...more] = project.visibility === 'public' ? project.media : [];
  // The project's own site leads. When a labeled link already points at
  // it, that link keeps Willie's label instead of a bare host.
  const own = project.website
    ? (project.links.find((link) => link.href === project.website) ?? {
        href: project.website,
      })
    : undefined;
  const links = [
    ...(own ? [own] : []),
    ...project.links.filter((link) => link !== own),
  ];

  return (
    <div className="project" style={schemeStyleFromHex(projectSeed(project))}>
      <div className="project-band">
        <TopBar crumbs={crumbs} column="content" />
        <header className="project-head">
          <h1>{project.title}</h1>
          {project.line && <p className="project-line">{project.line}</p>}
          <p className="project-facts">
            {projectFacts(project).map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </p>
          {project.collaborators.length > 0 && (
            <p className="project-facts">
              {project.collaborators.map((person) =>
                person.href ? (
                  <SiteLink key={person.name} href={person.href}>
                    {person.name}
                  </SiteLink>
                ) : (
                  <span key={person.name}>{person.name}</span>
                )
              )}
            </p>
          )}
          {(links.length > 0 || initiative || successor) && (
            <div className="project-links">
              {links.map((link, index) => (
                <SiteLink
                  key={link.href}
                  href={link.href}
                  className={index === 0 ? 'primary' : undefined}
                >
                  {link.label ?? linkLabel(link.href)}
                </SiteLink>
              ))}
              {initiative && (
                <SiteLink href={initiative.href}>{initiative.title}</SiteLink>
              )}
              {successor && (
                <SiteLink href={successor.href}>{successor.title}</SiteLink>
              )}
              {project.successor?.startsWith('https://') && (
                <SiteLink href={project.successor}>
                  {linkLabel(project.successor)}
                </SiteLink>
              )}
            </div>
          )}
        </header>
      </div>
      <main className="project-main">
        {hero && <ProjectMedia media={hero} hero />}
        {project.content && <InitiativeBody source={project.content} />}
        {more.map((media, index) => (
          <ProjectMedia key={index} media={media} />
        ))}
        {childProjects.length > 0 && (
          <ol className="project-children">
            {childProjects.map((child) => (
              <li key={child.slug}>
                <SiteLink href={child.href}>
                  <b>{child.title}</b>
                  {child.line && <span>{child.line}</span>}
                </SiteLink>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
```

```css
/* components/projects/project-page.css */
/* Neutral at rest; the --b-* scheme arrives inline from projectSeed. The
   band and hero overlap on purpose so the capture sits between the facts
   Willie recorded and the write-up he wrote. */
.project-band {
  padding-bottom: 12rem;
  background: var(
    --b-surface-container-low,
    var(--color-surface-container-low)
  );
  color: var(--b-on-surface, var(--color-on-surface));
}
.project-head {
  max-width: 760px;
  margin: 2.5rem auto 0;
  padding-inline: 1.25rem;
}
.project-head h1 {
  font-size: clamp(2.25rem, 4vw, 3.25rem);
  line-height: 1.1;
  font-weight: 600;
  letter-spacing: -0.04em;
}
.project-line {
  margin-top: 0.75rem;
  font-size: clamp(1.1875rem, 1.6vw, 1.375rem);
  color: var(--b-on-surface-variant, var(--color-on-surface-variant));
}
.project-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin-top: 1.125rem;
  font-size: 0.9375rem;
  color: var(--b-on-surface-variant, var(--color-on-surface-variant));
}
.project-facts > * + *::before {
  content: '·';
  margin-right: 0.75rem;
}
.project-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.375rem;
}
.project-links a {
  display: inline-flex;
  align-items: center;
  height: 2.5rem;
  padding: 0 1rem;
  border-radius: 999px;
  background: var(--b-secondary-container, var(--color-surface-container-high));
  color: var(--b-on-secondary-container, var(--color-on-surface));
  font-size: 0.875rem;
  font-weight: 600;
}
.project-links a.primary {
  background: var(--b-primary, var(--color-primary));
  color: var(--b-on-primary, var(--color-on-primary));
}
.project-main {
  max-width: 1000px;
  margin: -10rem auto 0;
  padding: 0 1.25rem 6rem;
}
.project-hero {
  overflow: hidden;
  border-radius: 20px;
  background: var(--b-primary-container, var(--color-surface-container-high));
  box-shadow: 0 30px 60px -40px rgb(0 0 0 / 0.5);
}
.project-hero img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  object-position: left top;
}
.project-main > .initiative-prose,
.project-figure,
.project-document,
.project-children {
  max-width: 680px;
  margin: 3.5rem auto 0;
}
.project-figure img {
  width: 100%;
  border-radius: 14px;
}
.project-children li a {
  display: grid;
  padding: 0.75rem 0;
}
@media (max-width: 599px) {
  .project-band {
    padding-bottom: 7.5rem;
  }
  .project-main {
    margin-top: -6rem;
  }
  .project-hero {
    border-radius: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .project * {
    transition: none !important;
  }
}
```

- [ ] **Step 5: Write the route and its social image**

```tsx
// app/projects/[codename]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ProjectPage from '@/components/projects/ProjectPage';

import { getInitiative } from '@/lib/initiatives';
import { childrenOf, getProject, getProjects } from '@/lib/projects';
import { pageMetadata } from '@/lib/site';

// Cache Components refuses an empty list, and every project is a draft in
// production until Willie clears the flag, so an underscore path stands in.
// The loader skips underscore files, so it prerenders as a plain 404.
export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.length > 0
    ? projects.map((project) => ({ codename: project.slug }))
    : [{ codename: '_' }];
}

export async function generateMetadata(props: {
  params: Promise<{ codename: string }>;
}): Promise<Metadata> {
  const { codename } = await props.params;
  const project = await getProject(codename);
  if (!project) notFound();
  return pageMetadata({
    title: project.title,
    description: project.line ?? project.title,
    path: project.href,
    image: `${project.href}/opengraph-image`,
  });
}

export default async function Page(props: {
  params: Promise<{ codename: string }>;
}) {
  const { codename } = await props.params;
  const projects = await getProjects();
  const project = projects.find((item) => item.slug === codename);
  if (!project) notFound();
  const bySlug = (slug?: string) =>
    slug ? (projects.find((item) => item.slug === slug) ?? null) : null;
  const initiative = project.initiative
    ? await getInitiative(project.initiative).catch(() => null)
    : null;
  return (
    <ProjectPage
      project={project}
      parent={bySlug(project.parent)}
      childProjects={childrenOf(projects, project.slug)}
      successor={
        project.successor?.startsWith('https://')
          ? null
          : bySlug(project.successor)
      }
      initiative={
        initiative ? { title: initiative.title, href: initiative.href } : null
      }
    />
  );
}
```

```tsx
// app/projects/[codename]/opengraph-image.tsx
import { publicImageDataUri, renderEntityImage } from '@/lib/og/render';
import { getProject } from '@/lib/projects';
import { projectSeed } from '@/lib/projects/brand';

export const alt = 'Project';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image(props: {
  params: Promise<{ codename: string }>;
}) {
  const { codename } = await props.params;
  const project = await getProject(codename);
  if (!project) return renderEntityImage({ title: 'Project' });
  const cover =
    project.visibility === 'public'
      ? project.media.find((media) => media.kind === 'image')
      : undefined;
  return renderEntityImage({
    title: project.title,
    description: project.line,
    brand: projectSeed(project),
    cover:
      cover?.kind === 'image' ? await publicImageDataUri(cover.src) : undefined,
  });
}
```

- [ ] **Step 6: Verify in the browser**

Start the dev server with the Browser pane's `preview_start` and the `web` configuration. Then check each of these:

1. `/projects/parlipro` shows the facts line "Creator · Lead Developer · 2023 · Unreleased", the two labeled links, the hero capture, and the full write-up including the companion-view figure.
2. `/projects/hackportal` shows only its header, with "ACM UTD" and the GitHub host label.
3. Switching the pane to dark mode keeps every line readable.
4. At a 390px width nothing scrolls sideways, and the hero sits inside the band.
5. `/projects/not-a-project` returns 404.

Save a screenshot of each page for the PR.

Run: `DRAFTS_BASE_URL=http://localhost:3000 pnpm exec playwright test tests/e2e/project-drafts.spec.mts --project=desktop --workers=1`
Expected: PASS.

- [ ] **Step 7: Run the full check**

Run: `pnpm test && pnpm content:check && pnpm lint && pnpm typecheck`
Expected: all exit 0.

Stop the dev server before building.

Run: `pnpm build && pnpm exec playwright test tests/e2e/project-pages.spec.mts --project=desktop --workers=1`
Expected: the build exits 0, and every draft returns 404 in production. The route prerenders only the `_` path.

- [ ] **Step 8: Commit**

```bash
git add app/projects components/projects tests/e2e/project-pages.spec.mts tests/e2e/project-drafts.spec.mts
git commit -m "feat(projects): Give every project its own page

Each visible project renders at /projects/<slug> with the facts it
records and, when Willie has written one, his write-up. A facts-only
project shows just its header, which covers work under NDA and older
projects with nothing left to show.

The route leaves app/_(pages) so it can be previewed in development;
every project is still a draft, so production serves 404 until Willie
clears each flag. The /projects index stays parked until he picks a
list layout.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Seeds from each project's own site

**Files:**

- Modify: `brand/resolve-brands.mjs:24` (the `SITES` map)

**Interfaces:**

- Consumes: the `website` field of every file in `content/projects` (Task 4).
- Produces: `lib/brand/seeds.json` entries keyed by project slug, which `projectSeed` reads (Task 3).

- [ ] **Step 1: Read project sites alongside the venture sites**

At the top of `brand/resolve-brands.mjs`, add the import:

```js
import matter from 'gray-matter';
```

Rename the existing `const SITES = {` to `const VENTURE_SITES = {`. After that object, add:

```js
const PROJECTS_DIR = path.join(HERE, '..', 'content', 'projects');

/** Each project's own site, keyed by slug, so its page can wear its colors. */
function projectSites() {
  if (!fs.existsSync(PROJECTS_DIR)) return {};
  return Object.fromEntries(
    fs
      .readdirSync(PROJECTS_DIR)
      .filter((file) => file.endsWith('.mdx') && !file.startsWith('_'))
      .map((file) => [
        file.replace(/\.mdx$/, ''),
        matter(fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf8')).data
          .website,
      ])
      .filter(([, url]) => typeof url === 'string')
  );
}

// Ventures win a key collision: a venture's own site is its brand.
const SITES = { ...projectSites(), ...VENTURE_SITES };
```

- [ ] **Step 2: Run the resolver**

Run: `pnpm brand:seeds`
Expected: it reports each site, and `lib/brand/seeds.json` gains a `parlipro` entry if parlipro.vercel.app yields a saturated color. If no color comes back, the page stays neutral, which is also correct.

- [ ] **Step 3: Run the tests and commit**

Run: `pnpm test && pnpm typecheck`
Expected: exit 0.

```bash
git add brand/resolve-brands.mjs lib/brand/seeds.json
git commit -m "feat(brand): Resolve brand seeds from each project's own site

A project's page should wear the colors of its own site before its
owner's, so lvwwd.org's teal is not replaced by LVBT orange. The
resolver now reads every project's website field and writes its seed
under the project's slug; a venture keeps its key when the two
collide.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Documentation

**Files:**

- Modify: `docs/projects.md` (rewrite)
- Modify: `docs/commits.md` (the `projects` scope)
- Modify: `docs/index.md` (the Content and Plans lists)
- Modify: `app/_(pages)/README.md` (the project note)

- [ ] **Step 1: Rewrite docs/projects.md**

Replace the file with a guide for whoever adds a project, whether Willie or an agent. It must cover these points:

1. The one rule, stated first. Every sentence on a project page is Willie's own words. An agent copies his text exactly and leaves a field empty rather than write it. The page omits whatever is empty.
2. The file location. Each project is `content/projects/<slug>.mdx`, and the slug is the URL.
3. The frontmatter table from this plan's Decisions section, updated to match `lib/projects/schema.ts`.
4. Visibility. `public` shows everything, `facts` shows the header only (use it for NDAs), and `hidden` shows nothing.
5. Drafts. A draft renders in development and returns 404 in production. Only Willie clears a draft flag.
6. Brand. It comes from `brand`, then a seed resolved from the project's `website` (`pnpm brand:seeds`), then the first owner.
7. How to add an owner: add a key to `lib/projects/owners.ts`.
8. Checking your work: run `pnpm test && pnpm typecheck`. The schema rejects unknown keys.

Delete the old three-column category table and the JSON copypasta.

- [ ] **Step 2: Update the projects scope and the indexes**

In `docs/commits.md`, change the `projects` line to:

```
- **`projects`** — the project content model, `lib/projects`, `components/projects`, and the `/projects` routes
```

In `docs/index.md`, change the Projects entry under Content to "the one-file-per-project schema, visibility, and the rule that every word is Willie's". Add this plan under "Plans and specs".

In `app/_(pages)/README.md`, note that the project detail route moved to `app/projects/[codename]`, and that only the `/projects` index is still parked.

- [ ] **Step 3: Commit**

```bash
git add docs "app/_(pages)/README.md"
git commit -m "chore(docs): Document the project content model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After this plan

This plan leaves several things for later, each needing Willie's decision or words:

1. **The `/projects` list.** It gets its own plan once Willie picks a layout on the canvas. Unparking it also means following the steps in `app/_(pages)/README.md`: restoring project items in the feeds and search, and setting `routed: true`.
2. **Current projects from Docket.** Willie decides which ones are public and writes or approves each line. An agent then copies his text into new files.
3. **Publishing any project.** It happens when Willie clears its `draft` flag himself.
4. **Confirmations.** Willie confirms the older projects' statuses and start years.
