# Tests

Start with [Testing](../docs/testing.md) to choose what to run for a change.
Test code is organized by the behavior it exercises:

```text
tests/
  unit/<domain>/         # Individual functions and module behavior
  integration/<domain>/  # Modules using an isolated database
  e2e/
    site/<domain>/       # Built website: navigation, UI, HTTP, accessibility
    publishing/          # Real-service publishing workflows, by protocol
      atproto/
      indieweb/
      standard-site/
      websub/
  support/               # Reusable helpers; no scenarios
    browser/
    publishing/          # Accounts, fixtures, authorization, recovery
  fixtures/              # Static inputs and standalone test assets
```

## Adding or changing a test

Put a test with the suite that answers its question. Unit tests use
`*.test.mts`; website browser tests use `*.spec.mts`. A publishing scenario has
an explicit CLI entrypoint because it can require interactive sign-in and
cleanup across runs. Playwright is scoped to `e2e/site/` and does not discover
or start publishing scenarios.

Use the same domain name as the component or library being tested. The test
command discovers unit tests recursively, so a test belongs with its domain
rather than at the root of the suite.

Keep helpers used only by one publishing scenario beside it. Share reusable
helpers through `support/`, and put input files in `fixtures/`. Support code
can import application libraries and other support code; it cannot import a
scenario or a command wrapper. Scenarios import application and support
modules directly. ESLint enforces these boundaries.

## Publishing scenario entrypoints

These paths are relative to the checkout. Run a scenario with
`pnpm exec tsx PATH` and the arguments described in the
[publishing runbook](../docs/publishing-verification.md). Choose and configure
the isolated environment before running a scenario; some commands publish,
deploy test content, or remove owned resources.

| Scenario                                                      | Entrypoint                                        |
| ------------------------------------------------------------- | ------------------------------------------------- |
| Standard.site record lifecycle and hosted agreement           | `tests/e2e/publishing/standard-site/run.mts`      |
| Bluesky copies and responses                                  | `tests/e2e/publishing/atproto/bluesky.mts`        |
| Hosted response rendering and refresh                         | `tests/e2e/publishing/atproto/responses/run.mts`  |
| Provider authorization, social behavior, and browser captures | `tests/e2e/publishing/atproto/capture/run.mts`    |
| Social writes and undo                                        | `tests/e2e/publishing/atproto/social.mts`         |
| Provider token refresh                                        | `tests/e2e/publishing/atproto/refresh.mts`        |
| Response overlap across protocols                             | `tests/e2e/publishing/atproto/overlap.mts`        |
| IndieWeb discovery and publishing, including media            | `tests/e2e/publishing/indieweb/run.mts`           |
| Published feed and media bytes                                | `tests/e2e/publishing/indieweb/feed-media.mts`    |
| Native media playback in the browser                          | `tests/e2e/publishing/indieweb/media-browser.mts` |
| WebSub subscription and delivery                              | `tests/e2e/publishing/websub/run.mts`             |

Shared account setup and teardown are in `support/publishing/identities/`.
`support/publishing/setup.mts` coordinates account setup, and
`support/publishing/token-inventory.mts` checks provider token cleanup. These
support the scenarios rather than introducing more test categories.

The old `scripts/*acceptance*` and verification script paths remain thin
compatibility entrypoints. Their filenames, flags, exported functions, and
saved recovery commands continue to work. New test code belongs here and
imports these modules directly. Historical evidence retains its original
command paths and claims.
