# willie.page

The source for [willie.page][website], Willie Chalmers III's personal website.
It is a [Next.js] 16 app using the App Router, written in TypeScript and MDX and
styled with Tailwind CSS.

Maintainer documentation lives in [docs/index.md](docs/index.md): deployment,
the content models, IndieWeb and protocol routes, design principles, and commit
conventions.

## Setup

You need Node.js 20.9 or later and [pnpm]. The repository pins its pnpm version
in the `packageManager` field of `package.json`, and pnpm switches to that
version on its own, so any recent pnpm install works:

```shell
git clone git@github.com:WillieCubed/website.git
cd website
pnpm install
```

`pnpm install` also installs the Husky pre-commit hook, which runs ESLint and
Prettier on staged files through lint-staged.

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

## Commands

| Command                 | What it does                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `pnpm dev`              | Starts the dev server behind portless                                                |
| `pnpm dev:app`          | Starts `next dev` directly                                                           |
| `pnpm build`            | Generates the search index, builds for production, and runs the postbuild scripts    |
| `pnpm start`            | Serves the production build                                                          |
| `pnpm test`             | Runs the unit tests in `tests/unit` with Node's test runner                          |
| `pnpm lint`             | Runs ESLint                                                                          |
| `pnpm typecheck`        | Generates route types and runs `tsc`                                                 |
| `pnpm check`            | Runs test, lint, typecheck, and build in order; run it before opening a pull request |
| `pnpm format`           | Formats the repository with Prettier                                                 |
| `pnpm brand:build`      | Regenerates the brand assets under `public/brand` from `brand/`                      |
| `pnpm search:index`     | Regenerates the search index on its own                                              |
| `pnpm websub:ping`      | Notifies the WebSub hub that the feeds changed                                       |
| `pnpm webmentions:send` | Sends webmentions for writings whose content changed                                 |

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and fill in only what you
need. Every variable is optional: the site builds and serves with none of them
set, and each feature turns itself off or falls back when its variable is
empty. `.env.example` describes each one. They cover:

- **Database:** a Postgres connection for webmentions, reply context, activity
  feeds, and Postgres-backed search.
- **Webmentions:** the secrets for sending and moderating webmentions, and the
  switches for the postbuild pings.
- **Micropub:** the IndieAuth token endpoint and where new posts are committed.
- **Search:** the search backend and the reindex secret.
- **Analytics:** the Google Analytics measurement ID.

The IndieWeb variables are explained in more depth in
[docs/indieweb/README.md](docs/indieweb/README.md).

## Routes

Pages:

- `/` is the homepage.
- `/initiatives` lists campaigns, series, and projects;
  `/initiatives/[slug]` and `/initiatives/[slug]/[part]` show one and its parts.
- `/writings` lists writings, and `/writings/[slug]` shows one.
- `/search` searches the site.

Feeds, IndieWeb, and protocol routes:

- RSS, Atom, and JSON feeds at `/feed.xml`, `/writings/feed.xml`, and
  `/activity/feed.xml`, with `/feed/atom`, `/feed/json`, and the matching
  paths under `/writings` and `/activity`.
- `/webmention`, `/webmentions`, `/micropub`, and `/oembed`, plus WebFinger,
  host-meta, and the AT Protocol DID under `/.well-known`. See
  [docs/indieweb/README.md](docs/indieweb/README.md).
- `/coffee`, `/tea`, `/whoami`, `/.well-known/security.txt`,
  `/opensearch.xml`, `/llms.txt`, and the MCP server at `/api/mcp`. See
  [docs/protocols.md](docs/protocols.md).

Older pages such as `/about`, `/projects`, and `/research` are parked under
`app/_(pages)`. The leading underscore keeps Next.js from routing them until they
are rebuilt.

## Deployment

The site deploys to Vercel from this repository, and `willie.page` is the
canonical origin. The older `williecubed.me` domain redirects there path for
path. Hosts, the redirect table, and the DNS steps are in
[docs/deploy.md](docs/deploy.md).

[website]: https://willie.page
[Next.js]: https://nextjs.org
[portless]: https://github.com/vercel-labs/portless
[pnpm]: https://pnpm.io
