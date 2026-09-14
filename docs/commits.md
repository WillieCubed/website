# Commit conventions

Commits use [Conventional Commits](https://www.conventionalcommits.org/) format with `type(scope): subject`.

## Scopes

Use one of these scopes. Omit the scope only for repository-wide changes.

- **`landing`** — the `/` route, including the hiatus landing page
- **`hiatus`** — the `SITE_MODE` gate in `proxy.ts` and `lib/site-mode.ts`
- **`pages`** — the routes under `app/_(pages)`
- **`projects`** — project data, `lib/projects`, and `components/projects`
- **`writings`** — the writing system: `lib/writings`, `components/writings`, and page routes
- **`content`** — data and content files under `content/` and `data/` directories
- **`theme`** — Tailwind configuration, `app/globals.css`, and shared styling
- **`indieweb`** — webmentions, feeds, discovery endpoints, and microformats; infrastructure for content interaction and syndication
- **`docs`** — maintainer documentation under `docs/`
- **`brand`** — the WillieCubed mark, the asset generator in `brand/`, and `/brand`
- **`deploy`** — the willie.page Worker under `deploy/`

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
