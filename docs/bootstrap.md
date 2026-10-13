# Bootstrap and preflight

For a new local checkout, use Node.js 24 and the pinned pnpm version in
`package.json`:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm check
pnpm dev
```

Fill only the local variables you need in `.env.local`; never commit the file.
`POSTGRES_URL` is a direct Neon URL for local development. Cloudflare Workers
use Hyperdrive and separate runtime secrets instead.

For Cloudflare deployment, create a named login with
`pnpm exec cf auth create williecubed`, then verify it with
`pnpm exec cf auth whoami --profile williecubed`. Confirm the account ID is
`18f90fa11cf0a87145be4a1517e41217`. `cf` keeps its own login, separate
from Wrangler; `cf auth login` changes the default profile only. The
Worker configs in the repository name the exact production and preview
Hyperdrive, R2, and Durable Object bindings. Provision
missing resources before deploying, then set secrets in each Worker. The
production and preview environments must have distinct OAuth keys, TOTP
secrets, cache buckets, media buckets, and databases. Use the production
`MICROPUB_GITHUB_TOKEN` only in production. Keep every credential out of
terminal arguments, Git history, and logs.

`pnpm build:cloudflare` builds the production origin. Run
`pnpm build:cloudflare:preview` for the isolated preview origin. Then deploy
with `pnpm deploy:cloudflare` or
`pnpm deploy:cloudflare:preview`, respectively.
Read [Deploying willie.page](deploy.md) for the current host list, build
connection, cutover order, and public acceptance checks.

The old Vercel bootstrap and preflight commands were removed when the hosting
provider changed. Historical acceptance receipts remain under
`docs/evidence/`; they do not prove the current Cloudflare deployment.
