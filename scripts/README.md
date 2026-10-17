# Commands

This directory contains commands for building, maintaining, and operating the
website. Commands and their helpers live under the domain that owns them:

| Directory     | Responsibility                                                |
| ------------- | ------------------------------------------------------------- |
| `atproto/`    | Document synchronization                                      |
| `cloudflare/` | Worker builds, packaging, deployment, and hosted checks       |
| `content/`    | Content validation and authoring checks                       |
| `indieweb/`   | Webmention maintenance and WebSub notifications               |
| `media/`      | Media fetching, discovery, and validation                     |
| `music/`      | Database and Worker provisioning                              |
| `search/`     | Search index generation                                       |
| `shared/`     | Command entrypoint and checkout-path helpers                  |
| `studio/`     | Studio runtime generation, schema migration, and draft import |

Every command lives under its domain; package scripts call those paths
directly, and there are no root-level aliases. Application behavior belongs in
`lib/`, not in a command module.

Do not add test implementations here; tests and their helpers live under
[`tests/`](../tests/README.md).

Import helpers from their owning module instead of importing a command
entrypoint. Keep standalone executable test assets in `tests/fixtures/`, where
tests can copy their exact bytes without bringing commands into the test
environment.

The former Vercel bootstrap, cutover, TOTP setup, production migration, and
live-media creation commands are retired. Their historical evidence retains its
original command names; it is not an instruction to recreate those commands.
