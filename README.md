# willie.page

This repository contains [willie.page](https://willie.page), Willie Chalmers III's
personal website. The app uses Next.js 16, TypeScript, MDX, and Tailwind CSS.

## Start locally

Use Node.js 24 or later and the pnpm version pinned in `package.json`. From an
unused parent directory, run:

```sh
git clone git@github.com:WillieCubed/website.git
cd website
pnpm install --frozen-lockfile
test -f .env.local || cp .env.example .env.local
pnpm dev
```

Open the URL printed by portless. A regular checkout uses
`https://williecubed.localhost:1355`; worktrees use a branch-prefixed host.
`pnpm dev:app` runs Next directly on `localhost:3000`. Both paths prepare the
Studio browser runtime, content manifests, and search index before serving.
Leave optional credentials empty for ordinary local reading and navigation.

The [local setup tutorial](docs/tutorials/operations/local-development.md)
provides checkpoints, checks, and cleanup. The
[documentation index](docs/README.md) lists the maintained contracts and guides.

## Change and verify

Routes compose domain views from `components/` and rules from `lib/`.
Commands live under `scripts/<domain>/`; tests follow the same domains under
`tests/`. The [architecture](docs/concepts/architecture/domain-boundaries.md)
defines dependency direction and ownership.

Run `pnpm check` and the relevant browser checks before publishing a change.
The [testing reference](docs/reference/operations/testing.md) distinguishes
unit, browser, database, and hosted verification. The
[command reference](docs/reference/operations/commands.md) lists package scripts.

Cloudflare builds production and private preview separately. Follow the
[deployment guide](docs/guides/operations/deploy.md) for the selected origin,
bindings, credentials, and hosted verification. Local checks do not deploy the
site or establish provider acceptance.
