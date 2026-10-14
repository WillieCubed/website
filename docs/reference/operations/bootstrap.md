# Local setup and deployment preparation

Local development needs the locked dependencies and a local environment file.
Cloudflare deployment also needs the correct account, provisioned bindings, and
secrets for the selected Worker. Keep those preparations separate: reading and
editing the site locally does not require access to its publishing deployment.

The old Vercel bootstrap and preflight commands were removed when the hosting
provider changed. Use the commands below and the
[local setup tutorial](../../tutorials/operations/local-development.md) for a
complete first-run exercise. Historical acceptance receipts remain under
`docs/evidence/`; they do not establish the current Cloudflare deployment's
behavior.

## Local workspace

### Install and check the repository

Use Node.js 24 and the pnpm version pinned in `package.json`. From the repository
root, install the locked dependency tree, create `.env.local` if it is absent,
then check and run the site:

```sh
pnpm install --frozen-lockfile
test -f .env.local || cp .env.example .env.local
pnpm check
pnpm dev
```

The conditional copy preserves an existing environment file. Fill only the
local variables you need; never commit `.env.local`. Leaving the database and
publishing credentials empty lets you work on ordinary content without
configuring hosted account or publishing features.

### Choose the database connection for the runtime

Local development uses a direct Neon `POSTGRES_URL`. Cloudflare Workers use
Hyperdrive bindings and separate runtime secrets instead. A local connection
string is therefore not a substitute for configuring the deployed Worker's
bindings. Keep every credential out of terminal arguments, Git history, and
logs.

## Cloudflare account and resources

### Verify the named login

Create the named login with `pnpm exec cf auth create williecubed`, then inspect
it with `pnpm exec cf auth whoami --profile williecubed`. The account ID must be
`18f90fa11cf0a87145be4a1517e41217`. The repository config pins that account;
verify the login before preparing a deployment so the credentials and target
agree.

`cf` keeps its own login, separate from Wrangler. `cf auth login` changes only
the default profile, so it does not replace creation of the named profile.
For local deployment scripts, set `CLOUDFLARE_PROFILE=williecubed`. The
[deployment guide](../../guides/operations/deploy.md#hosting-cloudflare-workers)
explains how the two tools participate in the build and upload.

### Preserve environment isolation

The Worker configs name the exact production and preview Hyperdrive, R2, and
Durable Object bindings. Provision missing resources before deploying, then
set secrets on each Worker. Production and preview must have distinct OAuth
keys, public cache buckets, media buckets, and public databases. Otherwise a
preview test could read or change the public environment's state.

They share the private writing database, private R2 bucket, Owner access
identity, and one scoped `STUDIO_GITHUB_TOKEN` value for publishing. Those shared
resources are deliberate; do not treat preview as a disposable copy of private
writing. Keep credentials out of terminal arguments, Git history, and logs.

## Build and deployment targets

Build each origin separately, then use the matching deployment command:

| Target          | Build                           | Deploy                           |
| --------------- | ------------------------------- | -------------------------------- |
| Production      | `pnpm build:cloudflare`         | `pnpm deploy:cloudflare`         |
| Private preview | `pnpm build:cloudflare:preview` | `pnpm deploy:cloudflare:preview` |

The build embeds the public origin and revision. Reusing one `.open-next`
directory for both targets would carry the wrong identity into one environment.
Read [Deploying willie.page](../../guides/operations/deploy.md) for host
configuration, build connections, deployment gates, and the checks needed
before retiring the old hosting projects.
