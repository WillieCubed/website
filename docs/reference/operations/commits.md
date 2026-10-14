# Commit conventions

Write commit subjects as `type(scope): subject`, following
[Conventional Commits](https://www.conventionalcommits.org/). The type describes
what kind of change you made; the scope identifies the part of the site it
affects. Together they help someone scanning history find a relevant change
before reading its explanation.

## Before committing

### Review the experience the change affects

For a page, content, style, or interaction change, review the affected
experience against all seven
[design principles](../../concepts/design/design-principles.md#before-committing).
Check the affected experience, including JavaScript-free use and end-user
resource costs. A hook can detect some source violations; it cannot decide
whether a playful detail is useful or an interaction is misleading.

Record an unmet requirement or necessary tradeoff in the change description.
That explanation lets a later maintainer distinguish a deliberate compromise
from a missed check. For documentation changes, use the
[editorial principles](../documentation/editorial-principles.md) and verify the
links, examples, and scope of any evidence claims.

### Describe one coherent change

The subject should identify what changes, with enough context to be useful in
history. Put the reason and material consequences in the body when the subject
cannot carry them. Use the narrowest scope below so someone investigating a
feature can find its history without reading every site-wide commit.

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
- **`music`** — playlist browsing, curation, ordered series, Spotify integration, and music publication
- **`projects`** — the project content model, `lib/projects`, `components/projects`, and the `/projects` routes
- **`writings`** — the writing system: `lib/writings`, `components/writings`, and page routes
- **`content`** — data and content files under `content/` and `data/` directories
- **`theme`** — how the site looks: Tailwind configuration, `app/globals.css`, and the colors, type, spacing, and motion every surface shares
- **`site`** — the chrome every page shares: the top bar and breadcrumbs, their menus, the footer and its dock, the skip link, fragment links, and page transitions in `components/site` and `lib/footer`. It is the last resort, not a catch-all: use it only when no other scope matches, so a breadcrumb change on initiative pages alone is `initiatives` and a color change is `theme`
- **`initiatives`** — the initiative content model, `lib/initiatives`, `components/initiatives`, and the `/initiatives` routes
- **`links`** — the in-site link component, hover cards, and the entity registry under `lib/entities`
- **`indieweb`** — webmentions, feeds, discovery endpoints, and microformats; infrastructure for content interaction and syndication
- **`seo`** — page titles, social metadata, structured data, and the sitemap: the metadata helpers in `lib/site.ts`, `lib/seo`, and `docs/reference/design/metadata.md`
- **`search`** — the command palette and site search: `components/palette`, `lib/palette`, `lib/search`, and `/search`
- **`protocols`** — the small protocol routes and headers (`/coffee`, `/tea`, `/whoami`, `security.txt`, OpenSearch, the MCP server); see `docs/reference/publishing/protocols.md`
- **`atproto`** — AT Protocol identity and records: `lib/atproto`, standard.site publishing, and the Bluesky integration; see `docs/reference/publishing/atproto.md`
- **`docs`** — maintainer documentation under `docs/`
- **`brand`** — the WillieCubed mark, the asset generator in `brand/`, and `/brand`
- **`deploy`** — hosting, redirects, and domain configuration

## Types

Choose the type from the resulting behavior:

- **`feat`** adds a capability.
- **`fix`** corrects broken behavior.
- **`chore`** covers refactoring, tooling, dependencies, and documentation.

This repository files performance work under `chore`; avoid `perf`. The local
convention takes precedence over the larger vocabulary Conventional Commits
allows, keeping history and tooling consistent.

## Breaking changes

Mark a breaking change with `type(scope)!: subject` and explain it in a
`BREAKING CHANGE:` footer. With no scope, use `type!: subject`. Identify the old
behavior, the new behavior, and what an affected caller or maintainer must
change. The marker draws attention to the compatibility boundary; the
explanation makes that attention useful.

## Example

Suppose a change lets readers subscribe to writings and lets other sites send
responses to them. The subject names the new capability; the body states what it
adds for readers:

```text
feat(indieweb): Add webmention and feed infrastructure

Let readers subscribe to writings and show responses from other sites beneath
the original post.
```

For a more involved change, explain the relevant constraint or tradeoff in the
body. Add a `Co-Authored-By` trailer only for an actual contributor, using that
person's or agent's correct attribution.
