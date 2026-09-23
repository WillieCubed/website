# Run the IndieWeb HTTP checks

This runbook is for a maintainer changing IndieWeb routes or markup. Run the
local checks, then use the [supported behavior contract](spec.md) to choose
which public interoperability checks the change affects. Keep the disposable
writing and database outside production.

## Read-only checks

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Then run
`pnpm exec playwright test tests/e2e/indieweb.spec.mts --project=desktop --workers=1`.
Set `INDIEWEB_TEST_BASE_URL` to a public deployment for a hosted run, and set
`NEXT_PUBLIC_SITE_ORIGIN` to the origin that deployment advertises. Set
`INDIEWEB_TEST_POST_PATH` to a published disposable writing to enable the
post and feed item check. Without that path, the post case skips.

## Isolated local write checks

Use a disposable PostgreSQL database and a disposable publishing fixture.
These commands assume local PostgreSQL is running and your shell can create a
database. Replace the connection string with your local test role if needed.

```sh
createdb indieweb_acceptance
export INDIEWEB_TEST_POSTGRES_URL=postgresql://localhost:5432/indieweb_acceptance
psql "$INDIEWEB_TEST_POSTGRES_URL" -v ON_ERROR_STOP=1 -f tests/support/webmentions.sql
psql "$INDIEWEB_TEST_POSTGRES_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/001_level4_tables.sql
psql "$INDIEWEB_TEST_POSTGRES_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/002_webmention_rate_limits.sql
psql "$INDIEWEB_TEST_POSTGRES_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/003_indieauth.sql
cp tests/fixtures/indieweb-acceptance.mdx content/writings/indieweb-acceptance.mdx
pnpm build
```

`@vercel/postgres` requires a Neon-shaped URL. The test-only fetch shim routes
its SQL requests to the local PostgreSQL URL above. The self-signed HTTPS
source in the write test requires certificate verification to be disabled for
this one local command. Do not reuse these environment values for a hosted
server or a production check.

```sh
INDIEWEB_TEST_POST_PATH=/writings/indieweb-acceptance \
POSTGRES_URL='postgresql://test:pass@ep-local-pooler.us-east-1.aws.neon.tech/test?sslmode=require' \
WEBMENTION_MODERATION_SECRET=local-test-secret \
NODE_OPTIONS='--import=./tests/support/neon-local-postgres.mjs' \
NODE_TLS_REJECT_UNAUTHORIZED=0 \
pnpm exec playwright test tests/e2e/indieweb-write.spec.mts --project=desktop --workers=1
```

Remove the copied writing when the local checks finish, and rebuild before
checking a release. The write suite creates and removes its own Micropub note,
IndieAuth token, Webmention, HTTPS source, and certificate. It checks the
Micropub `Location` and content file. It checks verification, approval, public
JSON, page rendering, and deletion after the source link disappears.

A hosted publishing check also needs a test database and a separate GitHub
branch configured with `MICROPUB_GITHUB_REPO`, `MICROPUB_GITHUB_TOKEN`, and
`MICROPUB_GITHUB_BRANCH`. Set `NEXT_PUBLIC_SITE_ORIGIN` to the test deployment
origin at build time. Confirm the returned `Location`, branch commit, deployed
permalink, and feed entry. Keep GitHub credentials out of the repository and
do not give a public test deployment a broad personal token.

Record the deployment revision, date, test URL, response, and any case that
could not run. The [2026-09-23 record](verification-2026-09-23.md) shows the
format.
