# Agent notes

## Commit scopes

Commits use Conventional Commits with one of these scopes. Omit the scope only
for repository-wide changes.

- `landing`: the `/` route, including the hiatus landing page
- `hiatus`: the `SITE_MODE` gate in `proxy.ts` and `lib/site-mode.ts`
- `pages`: the routes under `app/_(pages)`
- `projects`: project data, `lib/projects`, and `components/projects`
- `writings`: writing content, `lib/writings`, and `components/writings`
- `theme`: Tailwind configuration, `app/globals.css`, and shared styling
- `content`: MDX and data files under `content/` and `data/`
