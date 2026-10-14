# Agent notes

Commit scopes and conventions are documented in [docs/reference/operations/commits.md](docs/reference/operations/commits.md). Scopes name changelog domains, not route types or file categories. Follow the domain across public UI, admin UI, APIs, and storage; add a missing domain to the declared list. Pick the most specific scope that matches; `site` is only for shared chrome that no other scope covers, never a catch-all.
Design decisions are governed by [docs/concepts/design/design-principles.md](docs/concepts/design/design-principles.md). Before committing changes to pages, content, styles, or interactions, review its seven-principle checklist on the affected experience.
Every visual iteration includes uncropped full-viewport screenshots at desktop and mobile sizes. Full-page captures supplement these screenshots; cropped components do not replace them.
Every in-site link uses `SiteLink`; the rule and the hover card are documented in [docs/reference/design/links.md](docs/reference/design/links.md).
Page titles and social previews follow [docs/reference/design/metadata.md](docs/reference/design/metadata.md).
Anything made with the WillieCubed logo follows `public/brand/guidelines.json`; how those rules are built is in [docs/reference/design/brand.md](docs/reference/design/brand.md).
Documentation starts at [docs/README.md](docs/README.md). Organize it by Diátaxis kind and domain. Follow [the documentation standard](docs/reference/documentation/organization.md) and [editorial principles](docs/reference/documentation/editorial-principles.md).
The repository is ESM (`"type": "module"`). Write `import`/`export`, use `.mjs`/`.mts` for configs and scripts, and treat CommonJS (`require`, `module.exports`, `.cjs`) as legacy: fix a module setting rather than adding an interop workaround.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
