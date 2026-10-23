# Testing

This reference helps Willie or another contributor choose what to run after a
change. CI runs some of the same commands you run locally; CI is where a test
runs, rather than a separate kind of test.

## Routine changes

Install Playwright's pinned browser once after installing locked dependencies:

```sh
pnpm exec playwright install chromium
```

The default unit suite includes headless Chromium fixtures. On Linux, use
`pnpm exec playwright install --with-deps chromium` when its system libraries
are absent. That installation may require administrator access. Then run these
from the checkout:

```sh
pnpm check
pnpm test:e2e
```

`pnpm check` runs documentation checks, unit tests, lint, TypeScript checking,
and a production build.
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

## Focused checks during development

Run the affected unit files directly while editing, keeping the Node runner at
two workers:

```sh
pnpm exec tsx --env-file=tests/unit/test.env --test --test-concurrency=2 tests/unit/docs/check-links.test.mts
pnpm docs:check
```

The direct unit command omits package preparation hooks. Run the owning
preparation command first when a test needs generated MDX or the Studio browser
runtime. `pnpm docs:check` validates maintained Markdown local links, reference
links, heading IDs, and explicit HTML anchors; it does not fetch external URLs.
The [command reference](commands.md) owns its discovery and exclusion rules.

Browser runs use at most two workers. Keep the strict single-row footer contract
when changing shared chrome; its tests never permit wrapping or stacking.
For build/browser metrics and unavailable-sample handling, follow
[performance diagnosis](../../guides/operations/performance.md).

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

Draft initiative title and breadcrumb transitions need the authenticated preview
fixture because the public build excludes draft pages. Run
`STUDIO_TEST_CONFIG=tests/transitions.config.mts pnpm test:studio` to exercise
the unchanged transition assertions at desktop and 390px widths. The tests also
check reduced motion.

The harness defaults to `next dev`. Set `STUDIO_TEST_PRODUCTION=1` to use
`next start` against the checkout's existing `.next` output. Build the intended
fixture mode first; the harness does not create a production build.

Set `STUDIO_TEST_METRICS=1` to run the current browser metrics analyzer instead
of Playwright scenarios. This mode seeds Music fixtures, points the analyzer at
the fixture server, and supplies a signed Access assertion for private probes.
It sets `PREVIEW_METRICS_PRIVATE_ONLY=1`, so the report has `scope: private` and
empty public route/journey maps. Public metrics require a separate run.
Combine it with `STUDIO_TEST_PRODUCTION=1` to inspect an existing production
build. The harness drops its isolated schema and stops its process groups on
completion or signals. Inspect public and private outcomes separately; entering
this mode does not establish that every target was measurable.

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

## Fixture coverage in CI

CI installs Chromium before the unit tests because some deployment tooling tests
use a small local browser fixture. The main job then runs the public production
browser suite and a separate seeded public Music suite. The fixture step uses an
ephemeral PostgreSQL service; it does not change the unit-test environment.

The private fixture job builds the preview target, then runs Studio, Music, and
private browser measurements with one browser worker. Each invocation creates
and removes its own schema. The identity issuer and provider responses are
fixtures, and the job uses no live provider credentials. CI uploads fixture
screenshots, traces, and the private metrics JSON when those files exist.

Set `STUDIO_TEST_DATABASE_URL` to select a test PostgreSQL connection. The
harness preserves that connection and adds its isolated schema to the
application URL. Without the override, it keeps using the `/tmp` socket.
`STUDIO_TEST_PRODUCTION=1` starts the existing Next.js production build instead
of the development server. These private measurements exercise that built
Next.js server; they do not establish deployed Cloudflare Worker behavior.

After building the matching public or preview target, run the same scenarios:

```sh
STUDIO_TEST_PRODUCTION=1 pnpm test:studio
STUDIO_TEST_PRODUCTION=1 MUSIC_E2E=1 pnpm test:studio
STUDIO_TEST_PRODUCTION=1 STUDIO_TEST_METRICS=1 pnpm test:studio
STUDIO_TEST_PRODUCTION=1 STUDIO_TEST_SITE_MODE=public MUSIC_E2E=1 \
  STUDIO_TEST_CONFIG=tests/music-public.config.mts pnpm test:studio
```

The first three commands require a preview build. The last command requires a
public build. Set the test database override for TCP-based test services.
