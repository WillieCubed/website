# willie.page

The source for [willie.page][website], Willie Chalmers III's personal website.
It is a [Next.js] 16 app using the App Router, written in TypeScript and MDX and
styled with Tailwind CSS.

Documentation starts at [docs/README.md](docs/README.md), organized by Concepts,
Reference, Tutorials, and Guides, with domains nested within each. Start with
the [local setup tutorial](docs/tutorials/operations/local-development.md) for a
fresh checkout.

## Organization

Code is grouped by role, then by the domain that owns it:

| Location                               | What belongs there                        |
| -------------------------------------- | ----------------------------------------- |
| `app/`                                 | Routes, layouts, and page composition     |
| `components/<domain>/`                 | Views, hooks, and their styles            |
| `lib/<domain>/`                        | Application rules, types, and data access |
| `scripts/<domain>/`                    | Maintenance commands and their helpers    |
| `tests/<suite>/<domain>/`              | Unit, integration, and end-to-end tests   |
| `tests/support/` and `tests/fixtures/` | Shared test helpers and inputs            |

Use the same domain name across those roles. See
[Architecture](docs/concepts/architecture/domain-boundaries.md) for concrete examples and dependency
rules. Existing root script paths remain compatibility entrypoints.

## Setup

Use Node.js 24 or later and [pnpm]. The `packageManager` field in `package.json`
pins pnpm's version. In an unused parent directory, create a fresh checkout:

```shell
git clone git@github.com:WillieCubed/website.git
cd website
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm check
```

The copy step assumes this new checkout has no `.env.local`; preserve that file
when working in an existing checkout. Fill only the values needed by the features
you are developing. Installation sets up Husky, whose pre-commit hook runs ESLint
and Prettier on staged files. The [local setup tutorial](docs/tutorials/operations/local-development.md)
provides checkpoints and troubleshooting.

Hosted deployment uses Cloudflare Workers and has separate account, storage, and
Access requirements. Follow the [deployment guide](docs/guides/operations/deploy.md)
when preparing those resources. The former Vercel bootstrap and preflight scripts
have been removed.

## Development

```shell
pnpm dev
```

`pnpm dev` runs `next dev` behind [portless], which serves the app at a stable
named URL, `https://williecubed.localhost:1355`, instead of a numbered port. In
a git worktree, portless prefixes the branch name, as in
`https://my-branch.williecubed.localhost:1355`, so several checkouts can run at
once. To skip portless and use plain `next dev` on `localhost:3000`, run
`pnpm dev:app`.

Both commands regenerate the search index first.

## Testing

For a routine change, run `pnpm check`, then `pnpm test:e2e`. These are also the
checks run by CI. Publishing changes can need additional tests against real
external services. See [Testing](docs/reference/operations/testing.md) for when to run those tests
and how their setup and cleanup work.

## Commands

| Command                          | What it does                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev`                       | Starts the dev server behind portless                                                        |
| `pnpm dev:app`                   | Starts `next dev` directly                                                                   |
| `pnpm build`                     | Builds Studio runtime, checks images, generates search/content manifests, and builds Next.js |
| `pnpm build:cloudflare`          | Builds the production Worker with its own origin and revision                                |
| `pnpm build:cloudflare:preview`  | Builds the private preview Worker                                                            |
| `pnpm deploy:cloudflare`         | Deploys the production Worker                                                                |
| `pnpm deploy:cloudflare:preview` | Deploys the private preview Worker                                                           |
| `pnpm start`                     | Serves the production build                                                                  |
| `pnpm test`                      | Runs the unit tests in `tests/unit` with Node's test runner                                  |
| `pnpm test:e2e`                  | Runs the Playwright smoke and axe tests in `tests/e2e/site` against the production build     |
| `pnpm lint`                      | Runs ESLint                                                                                  |
| `pnpm typecheck`                 | Generates route types and runs `tsc`                                                         |
| `pnpm check`                     | Runs test, lint, typecheck, and build in order; run it before opening a pull request         |
| `pnpm format`                    | Formats the repository with Prettier                                                         |
| `pnpm brand:build`               | Regenerates the brand assets under `public/brand` from `brand/`                              |
| `pnpm search:index`              | Regenerates the search index on its own                                                      |
| `pnpm websub:ping`               | Notifies the WebSub hub that the feeds changed                                               |
| `pnpm webmentions:send`          | Sends webmentions for writings whose content changed                                         |

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` when that file is absent. Leave values empty for ordinary local
reading and navigation. To use publishing, account, or database-backed features,
fill in their configuration as described in the example and linked references. A
missing value can disable a feature or make its endpoint unavailable, so a
working homepage does not mean every optional service is configured.

The configuration groups include:

- **Database:** storage for authorization, Webmentions, reply context, response
  observations, publishing recovery, status administration, and optional search.
- **Webmentions:** the secrets for sending and moderating webmentions, and the
  post-deployment notification workflow.
- **IndieAuth:** the owner's sign-in code secret and the introspection secret
  for the site's own IndieAuth server.
- **Micropub:** the publishing branch for client-created posts and the R2
  media bucket used for uploads.
- **AT Protocol:** publication identity, signing and storage keys, and the
  credential for syncing public records.
- **Search:** the search backend and the reindex secret.
- **Analytics:** the Google Analytics measurement ID.

The IndieWeb variables are explained in more depth in
[docs/reference/publishing/indieweb.md](docs/reference/publishing/indieweb.md).

## Routes

Pages:

- `/` is the homepage.
- `/initiatives` lists campaigns, trips, and series; `/initiatives/[slug]` and
  `/initiatives/[slug]/[part]` show one and its parts.
- `/projects` lists public projects, and `/projects/[codename]` shows one.
- `/media` lists published mentions and appearances.
- `/brand` provides the logo kit and usage rules.
- `/writings` lists writings, and `/writings/[slug]` shows one.
- `/search` searches the site.

Feeds, IndieWeb, and protocol routes:

- RSS, Atom, and JSON feeds at `/feed.xml`, `/writings/feed.xml`, and
  `/activity/feed.xml`, with `/feed/atom`, `/feed/json`, and the matching paths
  under `/writings` and `/activity`.
- `/webmention`, `/webmentions`, `/micropub`, `/micropub/media`, `/oembed`, and
  the IndieAuth server under `/indieauth`, plus WebFinger, host-meta, the
  IndieAuth metadata, and the AT Protocol DID under `/.well-known`. See
  [docs/reference/publishing/indieweb.md](docs/reference/publishing/indieweb.md).
- `/coffee`, `/tea`, `/whoami`, `/.well-known/security.txt`, `/opensearch.xml`,
  `/llms.txt`, and the MCP server at `/api/mcp`. See
  [docs/reference/publishing/protocols.md](docs/reference/publishing/protocols.md).

Retired page sources remain under `app/_(pages)` and do not create public
routes. About and Research also have unapproved replacements in
`app/_proposals`; they remain private pending Willie's content and publication
approval. See the
[profile proposals reference](docs/reference/content/public-profile.md) for that
review boundary.

## Deployment

The site deploys to Cloudflare Workers from this repository, and `willie.page` is the
canonical origin. The older `williecubed.me` domain redirects there path for
path. Hosts, the redirect table, and the DNS steps are in
[docs/guides/operations/deploy.md](docs/guides/operations/deploy.md).

[website]: https://willie.page
[Next.js]: https://nextjs.org
[portless]: https://github.com/vercel-labs/portless
[pnpm]: https://pnpm.io
