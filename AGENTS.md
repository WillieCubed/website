# Agent notes

Commit scopes and conventions are documented in [docs/commits.md](docs/commits.md).
Design decisions are governed by [docs/design-principles.md](docs/design-principles.md).
Every in-site link uses `SiteLink`; the rule and the hover card are documented in [docs/links.md](docs/links.md).
The maintainer docs index is [docs/index.md](docs/index.md).
The repository is ESM (`"type": "module"`). Write `import`/`export`, use `.mjs`/`.mts` for configs and scripts, and treat CommonJS (`require`, `module.exports`, `.cjs`) as legacy: fix a module setting rather than adding an interop workaround.
