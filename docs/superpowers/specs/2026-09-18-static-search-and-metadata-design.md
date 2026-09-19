# Site-wide search and metadata

Status: approved design, 2026-09-18. Based on `origin/main` at `c4b0ffd`.

Two independent parts share only `app/layout.tsx` and `lib/site.ts`:

1. **Search.** A ⌘K search over the whole site, built on Pagefind, alongside
   the existing server-rendered `/search`, which is widened to the same content.
2. **Metadata.** JSON-LD structured data, Open Graph and social card
   improvements, and robots and sitemap fixes.

## Decisions

| Question                           | Decision                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| What "static search" means         | Pagefind index and its Component UI, with ⌘K (`mod+k`) from the built-in trigger                                |
| Fate of the existing server search | Kept and widened to initiatives and static pages. `/search`, `/api/search`, Postgres and reindex keep contracts |
| How Pagefind is fed                | Pagefind Node API (`addCustomRecord`) from the same collector the server search uses, not an HTML crawl         |
| Metadata scope                     | JSON-LD, OG and social cards, crawl hygiene                                                                     |
| Left out                           | Metadata audit test, IndexNow ping, `llms-full.txt`, `SearchAction`, series OG images, image sitemap entries    |
| AI crawler policy                  | Unchanged intent: block training crawlers from `/writings/` only. Tokens are corrected                          |

## Current state that matters

- `/search` and `/api/search` answer from `public/search-index.json`, written
  by the `prebuild` script. They cover writings only. Postgres is optional
  (`SEARCH_BACKEND=postgres`).
- `docs/indieweb/README.md` marks IndieMark "search results on your own domain"
  as done because `/search?q=` puts results in the server HTML. That stays true.
- `search_index.slug` is `UNIQUE` across all content types and `published_at`
  is `NOT NULL` (`lib/db/migrations/001_level4_tables.sql`).
- The prebuild runs under `tsx`, outside Next, where `showDrafts`
  (`NODE_ENV !== 'production'`) is true. Draft filtering therefore has to be
  explicit. `content/initiatives/superbloom` and the `project-superbloom`
  writing are drafts today.
- The site emits no JSON-LD. `app/layout.tsx` sets no `icons` or `manifest`,
  and the icon files live in `public/`, not `app/`.

## Part 1: Search

### Shared collector

`lib/search/collect.ts` exports `collectSearchDocuments(): Promise<SearchableItem[]>`.
`generateSearchIndex` in `lib/search/index.ts` becomes a thin call to it, so
the reindex route and the prebuild script keep working unchanged.

`SearchableItem` in `lib/search/types.ts` changes:

- adds `path: string`, the site-relative URL. `searchResultPath` returns it
  instead of inferring from type and slug.
- `type` becomes `'writing' | 'initiative' | 'page' | 'project'`. `project`
  stays in the union but nothing emits it while projects are parked.
- exports `UNDATED = '1970-01-01T00:00:00.000Z'`. Items without a date use it,
  which satisfies `published_at NOT NULL` with no migration and sorts undated
  items last. `SiteSearch` shows a date only for writings.

What it collects, all with `draft: false` enforced explicitly:

| Source       | `slug` (unique key)                                                                     | `path`               | `published`              |
| ------------ | --------------------------------------------------------------------------------------- | -------------------- | ------------------------ |
| Writings     | `<slug>` (unchanged)                                                                    | `/writings/<slug>`   | `published`              |
| Initiatives  | `initiatives/<slug>`                                                                    | `initiative.href`    | `starts`, else `UNDATED` |
| Parts        | `initiatives/<slug>/<part>`                                                             | `<href>/<part-slug>` | `starts`                 |
| Static pages | `pages/<key>`, where `<key>` is the `href` without its leading slash, or `home` for `/` | the page's `href`    | `UNDATED`                |

Text for initiatives and parts is tagline, description and the MDX body, run
through the existing `stripMdxSyntax`. Static pages come from `STATIC_PAGES` in
`lib/entities/pages.ts`, which `lib/entities/registry.ts` also imports, so
hover cards and search share one list. A static page's item has empty
`content`: its description is its whole text, and repeating it doubled the
result excerpt.

### Server search, widened

- `lib/search/server.ts`: `searchContent` no longer pins `type = 'writing'`.
  It accepts `writing | initiative | page | all` and excludes `project`.
- `lib/search/postgres.ts`: `indexItem` writes `item.path` to `url`;
  `searchPostgres` maps `row.url` to `path`.
- `components/SiteSearch.tsx`: placeholder and empty-state copy say "Search"
  rather than "Search writings". The small-print line under a result comes
  from `resultMeta` in `lib/search/meta.ts`, which returns only the parts that
  apply (a type badge for non-writings, a date for writings, tags), so a
  separator never dangles.
- `app/search/page.tsx`: description reads "Search everything on willie.page";
  a line under the heading, hidden in hiatus mode, tells visitors ⌘K opens
  instant search on any page.
- `app/api/search/route.ts`: doc comment lists the new `type` values.

### Pagefind index

`pagefind` is a devDependency. `lib/search/pagefind.ts` has two functions:

- `toPagefindRecord(item)` (pure): `{ url: item.path, language: 'en', content: description and content joined by a blank line (an empty part is dropped), meta: { title, description, type }, filters: { type: [item.type], tag: item.tags } (tag omitted when empty), sort: { date: item.published } (omitted when UNDATED) }`.
- `buildPagefindIndex(items, outputPath)`: `createIndex`, `addCustomRecord` per item, clears `outputPath`, `writeFiles({ outputPath })`, then `close`. It throws if any call returns errors.

`scripts/generate-search-index.ts` (already the `prebuild`) collects once,
writes `public/search-index.json` as it does today, then calls
`buildPagefindIndex(items, 'public/pagefind')`. `/public/pagefind/` is added to
`.gitignore` beside `search-index.json`. Because the index exists before
`next build`, Vercel serves it from `public/` with no post-build step.

### ⌘K modal

- `components/search/SearchModal.tsx` (client) renders `PagefindDialog`, the
  `<pagefind-modal>` element, and, on `requestIdleCallback` after load, adds
  `/pagefind/pagefind-component-ui.js` (module) and
  `/pagefind/pagefind-component-ui.css`. The idle callback has a 2000ms
  timeout, so a page that never goes idle still gets the shortcut; where the
  method is missing, a 200ms `setTimeout` stands in. Pagefind emits both files
  next to the index, so UI and index versions always match; `writeFiles` does
  emit them, so the `@pagefind/component-ui` package is not needed.
- The index and WASM load only on the first search, not at idle.
- `components/search/pagefind.tsx` exports `PagefindTrigger` (props `compact`
  and `hideShortcut`) and `PagefindDialog`. They create the custom elements
  with `createElement`, so the project needs no global JSX type declarations.
- Trigger: the top bar's `PagefindTrigger` is `compact hide-shortcut` (icon
  only) at the right end of `components/site/TopBar.tsx`, and is not rendered
  in hiatus mode; the home rail in `components/home/Rail.tsx` carries the full
  trigger. The default shortcut `mod+k` gives ⌘K on macOS and Ctrl+K elsewhere;
  Esc closes; focus is trapped. The shortcut is suppressed while an input,
  textarea or contentEditable has focus (Pagefind's own behavior).
- Reserved space: `pagefind-modal-trigger:not(:defined)` gets a 2.25rem square,
  matching Pagefind's default 36px input height, so the bar does not shift
  when the element upgrades. `TopBar` adds a `<noscript>` link to `/search`.
- Theming maps `--pf-*` variables (text, background, border, radius, focus
  outline, mark, font) to the warm tokens in `components/search/search.css`.
  The block is written on `:root:root`, because Pagefind's own stylesheet loads
  later and sets the same variables on `:root`, so it would otherwise win.
  Input height and font size stay at Pagefind's defaults: the trigger's height
  follows the input's. The Component UI does not follow `prefers-color-scheme`,
  and the site has one theme.
- `app/layout.tsx` mounts `<SearchModal />` beside `<SiteFooter />` unless
  `isHiatusMode()`.

### Failure modes

- Index missing (dev before `pnpm search:index`): Pagefind's `error` event shows
  its error state. `/search` still works from the server index.
- A collector failure fails the prebuild loudly, as it does today.
- `pagefind` binary unavailable on the build host: the prebuild exits non-zero.
  Confirmed by installing it during implementation; the first Vercel preview
  confirms Linux.

### Tests

- `tests/unit/search-collect.test.mts`: drafts excluded for writings,
  initiatives and parts with `NODE_ENV` unset; every `path` starts with `/`;
  slugs are unique across types; static pages present; undated items use
  `UNDATED`.
- `tests/unit/search-pagefind.test.mts`: `toPagefindRecord` field mapping,
  empty tags omitted, `UNDATED` sort omitted.
- `tests/unit/search-rank.test.mts`: fixtures gain `path`.
- `tests/unit/search-meta.test.mts`: `resultMeta` returns only the parts that
  apply, with a date for writings alone.
- After a real `pnpm build`: `public/pagefind/pagefind.js` exists, and a browser
  check that ⌘K opens the modal, a query returns a result, and the link resolves.

## Part 2: Metadata

### JSON-LD

`lib/seo/jsonld.ts` holds pure builders that return plain objects. All URLs
go through `absoluteUrl`. Optional fields are omitted, never `undefined`.
Entities use stable `@id`s (`<origin>/#website`, `#person`, `#org-<key>`).
A consumer resolves an `@id` only inside one document, so a page that
references the person includes the person node in its own graph.

| Page                  | Emits                                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                   | `WebSite` (`alternateName: 'WillieCubed'`), `Person` (`sameAs` from `site.social`, no email), `ProfilePage`; the `Person` lists the three ventures as `Organization`s under `worksFor` |
| `/writings/[slug]`    | `BlogPosting` (headline, dates, author `@id`, image, keywords, `isPartOf` for series), `BreadcrumbList`, `Person`                                                                      |
| `/initiatives/[slug]` | `BreadcrumbList`                                                                                                                                                                       |
| initiative part       | `BreadcrumbList`                                                                                                                                                                       |

Tour parts are story acts that span several cities, not events, so they carry
no `Event` markup. `Event` and `EventSeries` markup waits until the individual
events are modeled in the content with their own date, venue, and city.

`site.ventures` in `lib/site.ts` lists the three organizations with URLs taken
from the venture links already in `lib/home/ventures.ts`: Las Vegans for Better
Transit (`https://lasvegasfortransit.org/`), Hypertext Studio
(`https://hypertext.studio/`), Reasonable Tech Company
(`https://reasonabletech.co/`).

`components/seo/JsonLd.tsx` is a server component that renders
`<script type="application/ld+json">` from `JSON.stringify` with `<` escaped
as `\u003c`.

### Open Graph and social cards

In `pageMetadata()` (`lib/site.ts`):

- images become `{ url, width: 1200, height: 630, alt }`; `alt` is a new
  optional input and defaults to the title. The site card's alt is
  `site.shortDescription`.
- article fields: `authors`, `tags`, `section`, `publishedTime`,
  `modifiedTime` for `type: 'article'`.
- `labels?: [string, string][]` emits `twitter:label1/data1`, `label2/data2`
  through `other`, which Slack shows in unfurls. Writings pass reading time and
  published date; parts pass dates and place.

`app/writings/[slug]/page.tsx` moves onto `pageMetadata`, keeping its feed and
oEmbed `alternates.types`. New image routes `app/writings/opengraph-image.tsx`
and `app/initiatives/opengraph-image.tsx` use `renderEntityImage`, and their
pages pass them as `image`. Initiative and part pages export `generateViewport`,
which calls `initiativeViewport(slug)` in `lib/initiatives/viewport.ts`. It
returns `themeColor` from `brand` when that is a `#rrggbb` hex
(`viewportForBrand`) and nothing otherwise. Root metadata declares `icons`
(a 48px PNG, icon.svg, apple-touch-icon.png) and `manifest`
(`/manifest.webmanifest`), which the site never linked before; the built HTML
now carries all four links.

### Crawl hygiene

- `app/robots.ts`: `Googlebot-Extended` becomes `Google-Extended`; add
  `ClaudeBot`, `Applebot-Extended` and `meta-externalagent`; keep `GPTBot`,
  `CCBot`, `anthropic-ai`, `FacebookBot`, `Omgilibot`. Same rule: disallow
  `/writings/` only. `ChatGPT-User` stays listed as today.
- Root `metadata.robots` (live mode): `index`, `follow`, and
  `googleBot: { 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 }`.
- `app/sitemap.ts` and `lib/seo/sitemap.ts`: a pure `buildSitemap()` builds the
  entries and `app/sitemap.ts` feeds it the loaders' data. Remove
  `changeFrequency` and `priority` (Google ignores both). `lastModified` is set
  only from a known value: writings use `lastUpdated`; initiatives and parts
  use a new optional `updated` frontmatter date (`lib/initiatives/schema.ts`,
  documented in `docs/initiatives.md`); everything else omits it. The event end
  date is no longer used.

### Tests

- `tests/unit/seo-jsonld.test.mts`: each builder's required fields, absolute
  URLs, ISO dates, no `undefined` values, `<` escaping.
- `tests/unit/seo-metadata.test.mts`: `pageMetadata` image objects, default
  alt, article fields, Slack labels.
- `tests/unit/seo-robots.test.mts`: the AI tokens are disallowed from
  `/writings/`; `Slackbot`, `LinkedInBot`, `facebookexternalhit` and
  `Twitterbot` are never disallowed; the sitemap URL is absolute.
- `tests/unit/seo-sitemap.test.mts`: no `priority` or `changeFrequency`;
  drafts absent; `lastModified` only when known.
- `tests/unit/initiative-viewport.test.mts`: `viewportForBrand` returns a theme
  colour only for a `#rrggbb` brand.
- Rich Results Test and an OG preview check need a deployed URL, so they run
  manually after the first preview deploy.

## Files

Create: `lib/entities/pages.ts`, `lib/search/collect.ts`,
`lib/search/pagefind.ts`, `lib/search/meta.ts`, `components/search/search.css`,
`lib/seo/sitemap.ts`, `components/search/SearchModal.tsx`,
`components/search/pagefind.tsx`, `lib/initiatives/viewport.ts`,
`lib/seo/jsonld.ts`, `components/seo/JsonLd.tsx`,
`app/writings/opengraph-image.tsx`, `app/initiatives/opengraph-image.tsx`, and
the new test files named in each Tests section, plus
`tests/unit/search-server.test.mts` for `selectSearchable`.

Modify: `lib/search/{index,types,server,postgres}.ts`,
`components/SiteSearch.tsx`, `app/search/page.tsx`, `app/api/search/route.ts`,
`scripts/generate-search-index.ts`, `app/layout.tsx`,
`components/site/TopBar.tsx`, `components/home/Rail.tsx`,
`lib/entities/registry.ts`, `lib/site.ts`, `app/page.tsx`,
`app/writings/[slug]/page.tsx`, `app/writings/page.tsx`,
`app/initiatives/page.tsx`, `app/initiatives/[slug]/page.tsx`,
`app/initiatives/[slug]/[part]/page.tsx`, `app/robots.ts`, `app/sitemap.ts`,
`lib/initiatives/schema.ts`, `docs/initiatives.md`, `docs/indieweb/README.md`
(search rows: ⌘K added, `/search` unchanged), `package.json`, `.gitignore`,
`lib/initiatives/index.ts` (adds `loadAllInitiatives`), `eslint.config.mjs`
(ignores `public/pagefind/**`), `tests/unit/search-rank.test.mts`.

Delete: nothing.

## Risks to verify during implementation

1. Whether `writeFiles` emits `pagefind-component-ui.{js,css}`. If not, use the
   `@pagefind/component-ui` package. Resolved: it emits both, so the package is
   not used.
2. Whether pnpm 11's build-script policy lets `pagefind` install its platform
   binary. Confirmed when `pagefind` is added during implementation; the first
   Vercel build confirms Linux.
3. That the Pagefind trigger, themed with `--pf-*` variables, fits the design
   principles. If it cannot, replace it with a site-styled button that calls
   `modal.open()` and a small `mod+k` key handler.
4. That `BlogPosting` markup validates in Google's Rich Results Test on a
   deployed preview.
