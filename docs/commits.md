# Commit conventions

Commits use [Conventional Commits](https://www.conventionalcommits.org/) format with `type(scope): subject`.

## Scopes

Scopes identify the domain a reader looks for in the changelog. Follow that
domain across its public UI, admin UI, APIs, storage, and shared components.
Do not choose a scope from the route type, file location, or implementation
layer. Add a missing domain to this list instead of putting it under a broad
category. Omit the scope only for repository-wide changes.

- **`landing`** — the `/` route
- **`profile`** — Willie's background, biography, and research, including `/about` and `/research`
- **`status`** — current location, local time, and weather; includes `/status`, footer microstatus, status data sources, caching, and the admin status editor
- **`admin`** — shared owner identity and controls across status editing, IndieAuth approval, and the private writing studio
- **`projects`** — the project content model, `lib/projects`, `components/projects`, and the `/projects` routes
- **`writings`** — the writing system: `lib/writings`, `components/writings`, and page routes
- **`content`** — data and content files under `content/` and `data/` directories
- **`theme`** — how the site looks: Tailwind configuration, `app/globals.css`, and the colors, type, spacing, and motion every surface shares
- **`site`** — the chrome every page shares: the top bar and breadcrumbs, their menus, the footer and its dock, the skip link, fragment links, and page transitions in `components/site` and `lib/footer`. It is the last resort, not a catch-all: use it only when no other scope matches, so a breadcrumb change on initiative pages alone is `initiatives` and a color change is `theme`
- **`initiatives`** — the initiative content model, `lib/initiatives`, `components/initiatives`, and the `/initiatives` routes
- **`links`** — the in-site link component, hover cards, and the entity registry under `lib/entities`
- **`indieweb`** — webmentions, feeds, discovery endpoints, and microformats; infrastructure for content interaction and syndication
- **`seo`** — page titles, social metadata, structured data, and the sitemap: the metadata helpers in `lib/site.ts`, `lib/seo`, and `docs/metadata.md`
- **`search`** — the command palette and site search: `components/palette`, `lib/palette`, `lib/search`, and `/search`
- **`protocols`** — the small protocol routes and headers (`/coffee`, `/tea`, `/whoami`, `security.txt`, OpenSearch, the MCP server); see `docs/protocols.md`
- **`atproto`** — AT Protocol identity and records: `lib/atproto`, standard.site publishing, and the Bluesky integration; see `docs/atproto.md`
- **`docs`** — maintainer documentation under `docs/`
- **`brand`** — the WillieCubed mark, the asset generator in `brand/`, and `/brand`
- **`deploy`** — hosting, redirects, and domain configuration

## Types

Reach for these first:

- **`feat`** — adds a capability
- **`fix`** — corrects broken behavior
- **`chore`** — refactors, tooling, dependencies, and documentation

Avoid `perf`; file performance work under `chore` instead.

## Breaking changes

Mark with `!` after the type, and explain in a `BREAKING CHANGE:` footer.

## Example

```
feat(writings): Add webmention and feed infrastructure

Restore IndieWeb functionality to the writing system.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```
