# Commands

Maintainers use these package scripts from the repository root. `package.json`
owns their executable definitions. A build creates local output; deployment and
notification commands change external state.

| Command                          | What it does                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm content:prepare`           | Prepares and verifies the Studio, MDX, search, and content manifest artifacts                |
| `pnpm docs:check`                | Validates maintained Markdown local links and anchors                                        |
| `pnpm dev`                       | Starts the dev server behind portless                                                        |
| `pnpm dev:app`                   | Starts `next dev` directly                                                                   |
| `pnpm build`                     | Builds Studio runtime, checks images, generates search/content manifests, and builds Next.js |
| `pnpm build:cloudflare`          | Builds the production Worker with its own origin and revision                                |
| `pnpm build:cloudflare-preview`  | Builds the private preview Worker                                                            |
| `pnpm build:metrics`             | Builds the production Worker and records build size and source metrics                       |
| `pnpm preview:cloudflare`        | Runs the local Cloudflare Worker preview                                                     |
| `pnpm preview:metrics`           | Measures browser performance on the local Worker preview                                     |
| `pnpm deploy:cloudflare`         | Deploys the production Worker                                                                |
| `pnpm deploy:cloudflare-preview` | Deploys the private preview Worker                                                           |
| `pnpm start`                     | Serves the production build                                                                  |
| `pnpm test`                      | Runs the unit tests in `tests/unit` with Node's test runner                                  |
| `pnpm test:e2e`                  | Runs the Playwright smoke and axe tests in `tests/e2e/site` against the production build     |
| `pnpm lint`                      | Runs ESLint                                                                                  |
| `pnpm typecheck`                 | Generates route types and runs `tsc`                                                         |
| `pnpm check`                     | Runs documentation checks, unit tests, lint, typecheck, and build in order                   |
| `pnpm format`                    | Formats the repository with Prettier                                                         |
| `pnpm brand:build`               | Regenerates the brand assets under `public/brand` from `brand/`                              |
| `pnpm search:index`              | Regenerates the search index on its own                                                      |
| `pnpm websub:ping`               | Notifies the WebSub hub that the feeds changed                                               |
| `pnpm webmentions:send`          | Sends webmentions for writings whose content changed                                         |

## Generated artifact preparation

`pnpm content:prepare` prepares Studio runtime, compiled MDX, search, and the
Worker content manifest in that order. Development, build, typecheck, unit,
integration, and Studio test commands use this shared preparation entrypoint.
Direct generator commands remain available for focused work.

The preparer reuses a stage only when its input fingerprint and output bytes
match. Inputs include stage sources, configuration, lockfiles, Node version,
and the selected `NEXT_PUBLIC_*`/`SITE_*` environment values. Missing or edited
outputs regenerate even if source is unchanged. A failed or incomplete generator
cannot record a successful cache entry. Cache records live under the ignored `.cache/preparation/` directory. Each
generated output keeps its declared tracked or ignored status in the repository. This build-artifact reuse does not define runtime content freshness.

## Documentation and content checks

`pnpm docs:check` validates local Markdown links and anchors in maintained,
Git-visible documentation. It reads inline and reference links, heading IDs, and
explicit HTML anchors. Git-ignored output, scratch/evidence/plan directories,
and dated Markdown receipts do not participate. An explicit file argument to
`pnpm exec tsx scripts/docs/check-links.mts path/to/document.md` narrows a check.
It does not fetch external links or validate runtime site URLs in MDX.

`pnpm content:check` checks authored image descriptions and referenced media.
`pnpm spacing:check` checks the semantic spacing contract. `pnpm lint` also runs
the spacing checker. See [testing](testing.md) for test-service requirements and
[performance diagnosis](../../guides/operations/performance.md) for metrics runs.
