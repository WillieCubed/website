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

| Tests                 | What they answer                                                     | Where they live         | How they run                                         |
| --------------------- | -------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------- |
| Unit                  | Does this function or module handle its inputs correctly?            | `tests/unit/`           | `pnpm test`, locally and in CI                       |
| Integration           | Do these modules work together against a real test database?         | `tests/integration/`    | Explicitly, with the isolated database configuration |
| Website end-to-end    | Can someone navigate and use the built website?                      | `tests/e2e/site/`       | `pnpm test:e2e`, locally and in the CI browser job   |
| Publishing end-to-end | Does publishing work through the website and real external services? | `tests/e2e/publishing/` | Explicitly, with isolated accounts and services      |

The browser suite also checks route responses, feeds, discovery documents,
accessibility, and protocol behavior. Some cases need an explicitly configured
test database or writing and skip without those fixtures. See the
[IndieWeb test instructions](indieweb/testing.md) for those cases.

## Database integration tests

`tests/integration/atproto/oauth.test.mts` tests OAuth state, session storage, and
locking against the isolated database. It uses test identities and provider
fixtures. It is distinct from publishing end-to-end tests that complete real
provider authorization. See the [AT Protocol guide](atproto.md) for its
configuration and invocation.

## Changes that need real services

Use live publishing tests when a change needs proof that accounts, sign-in,
publishing, federation, response delivery, or deployment workflows work together.
For example, a unit test can check the record produced for a Bluesky post. A
live test publishes it through the real service and checks that the website
receives and renders the resulting replies.

Both website and publishing scenarios are end-to-end tests and live under
`tests/e2e/`. Publishing tests use explicit CLI workflows because some span
interactive sign-in, asynchronous external delivery, multiple commands, and
cleanup after interruption. The current CI workflow does not invoke them.
They are not part of `pnpm check` or the default `pnpm test:e2e` run.

The [publishing test runbook](publishing-verification.md) maps each command to
the behavior it checks and documents its required environment. Existing
filenames, flags, environment names, and saved files retain “acceptance” for
compatibility. It means testing the complete publishing workflow here; it
does not mean a CI-specific system.

## Setup, results, and cleanup

Account provisioning and cleanup support the publishing tests. Their shared
implementation lives under `tests/support/publishing/`, with per-scenario
cleanup beside the scenario it owns. Static inputs and the standalone test
SMTP server live under `tests/fixtures/`. Browser and parsing helpers also
live under `tests/support/`; helpers are separate from test scenarios.

The [test directory guide](../tests/README.md) lists scenario entrypoints.
Existing root script filenames remain compatible commands for saved
instructions. Both forms execute the same implementation. Importing a module
does not start a live run.

A live run saves results and an ownership journal: which test resources it
created and what is needed to remove them. An interrupted run resumes cleanup
from that journal. These files are part of recovery, so keep them until cleanup
finishes. The runbook calls the saved result a receipt.

The setup commands create isolated test accounts and infrastructure; test
scenarios can publish real content there. They are intentional maintainer
operations, separate from the checks needed for an ordinary code change.
Offline unit tests cover their ownership and recovery logic without contacting
providers.
