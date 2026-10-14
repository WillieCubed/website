# Site build record

The colophon identifies the artifact a visitor is reading. Its current version
is the source Git revision, linked to the full commit; it does not identify the
most recently edited writing or the newest run in CI.

`scripts/shared/build-record.mts` resolves the public metadata when Next loads
its build configuration. `next.config.ts` compiles one `SITE_BUILD_RECORD`
into the application. `lib/site/build.ts` reads that record for `/colophon`,
`/api/indieweb/revision`, and `/humans.txt`. The revision endpoint retains its
`sha` and `runtime` fields and adds `builtAt` and `buildUrl`.

The Cloudflare build wrapper supplies `SITE_BUILT_AT` once before launching
OpenNext, so nested build steps share the same timestamp. Ordinary Next builds
capture it in the configuration. Starting the production server does not change
the timestamp compiled into the artifact. Development has no completed build
time and is labeled as a development checkout.

Workers Builds supplies `WORKERS_CI_BUILD_UUID` and `WORKERS_CI_COMMIT_SHA`.
The build record links to that exact run for the selected production or preview
Worker; the dashboard requires Cloudflare sign-in. GitHub Actions builds use
`GITHUB_REPOSITORY`, `GITHUB_RUN_ID`, and `GITHUB_SHA` to link to their producing
run. An explicit `NEXT_PUBLIC_SITE_REVISION` takes precedence, with the checkout
revision as the local fallback. Local builds have no CI run and say so.

Only the revision, timestamp, public build URL, provider, and development marker
enter the record. Invalid revisions, timestamps, or run identifiers fail the
build. Never add tokens, environment dumps, or authenticated API responses.

After deployment, compare the colophon's version and timestamp with the revision
endpoint and the producing run. A successful CI run alone does not establish
which artifact the public host serves. Content and live information may change
without rebuilding the application.
