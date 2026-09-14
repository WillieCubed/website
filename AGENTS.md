# Agent notes

## Commit scopes

Commits use Conventional Commits with one of these scopes. Omit the scope only
for repository-wide changes.

- `landing`: the `/` route, including the hiatus landing page
- `hiatus`: the `SITE_MODE` gate in `proxy.ts` and `lib/site-mode.ts`
- `pages`: the routes under `app/_(pages)`
- `projects`: project data, `lib/projects`, and `components/projects`
- `writings`: the writing system—`lib/writings`, `components/writings`, and writing display/processing
- `content`: data and content files under `content/` and `data/` directories
- `theme`: Tailwind configuration, `app/globals.css`, and shared styling
- `indieweb`: webmentions, feeds, discovery endpoints, and microformats—infrastructure for content interaction and discovery
- `docs`: maintainer documentation under `docs/`
