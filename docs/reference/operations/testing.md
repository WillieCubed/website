# Testing

This guide helps Willie or another contributor choose what to run after a
change. CI runs some of the same commands you run locally; CI is where a test
runs, rather than a separate kind of test.

## Routine changes

Run these from the checkout:

```sh
pnpm check
pnpm test:e2e
```

`pnpm check` runs unit tests, lint, TypeScript checking, and a production build.
The browser suite uses that build. Changes to publishing logic also need the
unit and browser tests; live tests provide additional coverage when needed.

| Tests              | What they answer                                             | Where they live      | How they run                                                      |
| ------------------ | ------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------- |
| Unit               | Does this function or module handle its inputs correctly?    | `tests/unit/`        | `pnpm test`, locally and in CI                                    |
| Integration        | Do these modules work together against a real test database? | `tests/integration/` | `pnpm test:integration`, with the isolated database configuration |
| Website end-to-end | Can someone navigate and use the built website?              | `tests/e2e/site/`    | `pnpm test:e2e`, locally and in CI                                |

The browser suite also checks route responses, feeds, discovery documents,
accessibility, and protocol behavior. Some cases need an explicitly configured
test database or writing and skip without those fixtures. See the
[IndieWeb test instructions](../../guides/publishing/indieweb-testing.md) for those cases.

## Database integration tests

`tests/integration/atproto/oauth.test.mts` tests OAuth state, session storage, and
locking against the isolated database. It uses test identities and provider
fixtures. Load the isolated configuration into the environment
and run `pnpm test:integration`. The Postgres portability test skips unless
`WEBSITE_TEST_DATABASE_URL` is set. See the [AT Protocol guide](../publishing/atproto.md)
for the OAuth test's configuration.

## Private writing and music

The default browser run skips the private Studio and Music scenarios. Run them
against a local PostgreSQL server listening on `/tmp`:

```sh
pnpm test:studio
MUSIC_E2E=1 pnpm test:studio
```

The harness creates and removes an isolated schema, starts a local preview with
signed test identities, and supplies fake provider responses. The Music run also
checks the public gallery using its isolated approved cache. These tests use no
live provider accounts. Each browser suite writes to its own result directory
under `test-results/`.

Database-backed unit cases run when `STUDIO_TEST_DATABASE_URL` identifies a local
test database. Set `STUDIO_TEST_BROWSER=1` to include the widget sandbox browser
case. These cases use temporary schemas and fixture providers.

## Changes that need real services

Some changes need proof that accounts, sign-in, publishing, federation, response
delivery, or deployment work together through real services. For example, a
unit test can check the record produced for a Bluesky post, but only a live run
shows that the website receives and renders the resulting replies.

No hosted publishing runner is current: the October 2026 suite targeted a
retired Vercel project and was removed. The
[publishing verification guide](../../guides/publishing/publishing-verification.md)
describes what a new runner must establish, including an ownership journal that
lets an interrupted run remove exactly the resources it created.
