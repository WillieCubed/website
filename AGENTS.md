# Agent notes

Commit scopes and conventions are documented in [docs/commits.md](docs/commits.md).
Design decisions are governed by [docs/design-principles.md](docs/design-principles.md).
Every in-site link uses `SiteLink`; the rule and the hover card are documented in [docs/links.md](docs/links.md).
The maintainer docs index is [docs/index.md](docs/index.md).
The repository is ESM (`"type": "module"`). Write `import`/`export`, use `.mjs`/`.mts` for configs and scripts, and treat CommonJS (`require`, `module.exports`, `.cjs`) as legacy: fix a module setting rather than adding an interop workaround.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
