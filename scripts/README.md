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
| `music/`      | Private/public schema migration and provider provisioning     |
| `search/`     | Search index generation                                       |
| `shared/`     | Command entrypoint and checkout-path helpers                  |
| `studio/`     | Studio runtime generation, schema migration, and draft import |

Root files preserve existing filenames and arguments by delegating to their
owning module. Package commands use the domain paths directly. New commands
belong under their domain. Application behavior belongs in `lib/`, not in a
command module.

Publishing test scenarios live in [`tests/e2e/publishing/`](../tests/README.md).
Their shared account, authorization, fixture, and recovery helpers live in
`tests/support/publishing/`. Retained acceptance and verification script names
remain thin compatibility entrypoints so documented commands and saved
recovery instructions keep working. Do not add test implementations here.

Import helpers from their owning module instead of importing a command
entrypoint. A compatibility re-export is retained only for existing callers;
new code uses the implementation directly. Keep standalone executable test
assets in `tests/fixtures/`, where tests can copy their exact bytes without
bringing command wrappers into the test environment.

The former Vercel bootstrap, cutover, TOTP setup, production migration, and
live-media creation commands are retired. Their historical evidence retains its
original command names; it is not an instruction to recreate those commands.
