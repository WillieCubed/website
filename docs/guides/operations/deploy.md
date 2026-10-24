# Deploying willie.page

Maintainers build the selected origin, deploy it to its configured Cloudflare
Worker, and verify the revision served there. Production and private preview
have different public identities and storage boundaries. Read the
[setup reference](../../reference/operations/bootstrap.md) before preparing
credentials or resources.

## Select the target

`cloudflare.config.ts` owns account `18f90fa11cf0a87145be4a1517e41217`, Worker
bindings, custom domains, and compatibility flags. Production uses `willie-page`;
preview mode uses `willie-page-preview`. `wrangler.config.ts` owns bundler
settings. OpenNext generates a temporary Wrangler config for builds and local
preview.

| Host                  | Role                                  | Where it is configured                 |
| --------------------- | ------------------------------------- | -------------------------------------- |
| `willie.page`         | canonical origin                      | `lib/site/identity.ts` (`site.origin`) |
| `preview.willie.page` | private writing preview behind Access | `cloudflare.config.ts`                 |
| `www.willie.page`     | 308 to the apex, path for path        | `site.legacyHosts`, `next.config.ts`   |
| `williecubed.me`      | 308 to willie.page, path for path     | `site.legacyHosts`, `next.config.ts`   |
| `www.williecubed.me`  | 308 to willie.page, path for path     | `site.legacyHosts`, `next.config.ts`   |
| `tour.willie.page`    | 307 to `/initiatives/fall-tour-2026`  | `site.aliasHosts`, `next.config.ts`    |
| `diaries.willie.page` | 307 to `/initiatives/twd`             | `site.aliasHosts`, `next.config.ts`    |

The 308 redirects preserve older links after the move to the canonical host.
Initiative aliases use 307 redirects because their destinations can change:
`tour.willie.page` is an entry point for the current tour, while the initiative's
full URL identifies that particular trip.

The redirect table comes from `lib/site/identity.ts` and `next.config.ts`.
Attaching a hostname is separate from defining its redirect. Preserve mail and
identity DNS records when changing web routing. A source declaration does not
prove that the provider currently serves the domain.

## Prepare credentials and storage

Create the named profile with `pnpm exec cf auth create williecubed`, then check
it with `pnpm exec cf auth whoami --profile williecubed`. Confirm the account ID
above. Set `CLOUDFLARE_PROFILE=williecubed` for local deployment commands.
`cf` and Wrangler keep separate credentials.

Inspect the bindings in the selected `cloudflare.config.ts` mode before upload.
Production and preview have distinct public Hyperdrive connections, cache
buckets, media buckets, Durable Objects, and OAuth keys. They deliberately share
`STUDIO_HYPERDRIVE`, `STUDIO_PRIVATE_BUCKET`, owner Access identity, and the scoped
`STUDIO_GITHUB_TOKEN`. Preview also binds `STUDIO_PUBLIC_MEDIA_BUCKET` to the
production media bucket for approved publication. Shared private writing data
and promoted public media are not disposable preview fixtures.

Set the declared secret bindings on the named Worker through `cf workers secrets
update` or a private deployment secrets file. Keep values out of arguments and
Git. `.env.example` documents local names; the
[IndieWeb configuration](../../reference/publishing/indieweb-configuration.md),
[AT Protocol reference](../../reference/publishing/atproto.md),
[Music reference](../../reference/content/music.md), and
[private writing guide](../publishing/private-writing.md) own feature requirements.

Public identity settings such as `NEXT_PUBLIC_SITE_ORIGIN`,
`NEXT_PUBLIC_ATPROTO_DID`, and `NEXT_PUBLIC_BLUESKY_HANDLE` are build inputs.
Set them before the build. `NEXT_PUBLIC_GTAG_ID` is optional; no Google Analytics
script is emitted without it. Confirm any provider-injected analytics separately
in the hosted response and provider account.

## Build and upload matching output

Run one row for the intended target:

| Target          | Build                           | Upload                           |
| --------------- | ------------------------------- | -------------------------------- |
| Production      | `pnpm build:cloudflare`         | `pnpm deploy:cloudflare`         |
| Private preview | `pnpm build:cloudflare-preview` | `pnpm deploy:cloudflare-preview` |

Build each origin separately. Reusing `.open-next` output across targets can
carry the wrong public identity and revision. `cf` uploads this Worker's Durable
Object exports; Wrangler prepares the bundle. Use the repository scripts rather
than a bare upload command. The scripts supply a loopback-only placeholder
Postgres URL to OpenNext's local proxy; deployed requests use configured
Hyperdrive bindings.

The production Workers Builds connection should track `main`, use
`pnpm build:cloudflare`, and deploy with `pnpm deploy:cloudflare`. Set
`PNPM_VERSION` to the version in `package.json`. Deploy preview deliberately with
its own commands. Inspect the live provider build connection before changing it;
repository source cannot establish its current dashboard state.

The IndieWeb notification GitHub Action waits for the canonical revision and
then calls the authenticated production notification endpoint. Set its
`INDIEWEB_NOTIFY_SECRET_PRODUCTION` to the corresponding Worker secret. Check
both the Worker deployment and notification result for a real publish.

## Verify the deployed origin

After production upload, run the read-only route gate with the exact SHA:

```sh
pnpm exec tsx scripts/cloudflare/verify-public-routes.mts --origin https://willie.page --sha "$(git rev-parse HEAD)"
```

The command checks deployed revision, binding marker, public route responses,
redirects, IndieAuth issuer, and anonymous admin denial. `--output <private-path>`
saves its receipt outside the repository. This does not prove authenticated
writes, Spotify consent, database usage, uploads, or subscriber delivery.

For private preview, confirm that anonymous requests reach Access, direct
`workers.dev` requests cannot bypass owner checks, and signed owner reads and
writes succeed through `preview.willie.page`. The public route gate does not
apply to this protected target. Use [publishing verification](../publishing/publishing-verification.md)
for authenticated and outside-service acceptance. Keep approved authored text
and fixture cleanup separate from deployment checks.

## Inspect resource use and recovery

Collect fresh usage from the selected Cloudflare account and each database
project. Inspect requests, CPU, Durable Object work, R2 operations/storage, and
Images transformations. Compare those observations with the account's current
plan. Old dashboard readings and pricing figures do not establish a current
budget or allowance. A budget alert does not enforce a spending ceiling.

The repository's read-only Neon checker records its configured project IDs:

```sh
pnpm exec tsx scripts/cloudflare/check-neon-free.mts --output /tmp/willie-neon-current.json
```

Use `--previous /path/to/earlier.json` to compare samples. The checker requires
six hours between samples for a forecast and uses configured alert thresholds
of 80 CU-hours and 800 MB. Those constants are operational thresholds, not proof
of the account's plan. Inspect its project inventory before relying on it for
coverage; it does not automatically discover every private database.

Before destructive schema work, retain a private logical backup and verify a
restore into an isolated database. Check the provider's current recovery window
rather than relying on an older restore receipt.

## Preserve runtime boundaries

Keep `global_fetch_strictly_public` on both Workers. Node public fetch checks
DNS at connection time; Worker fetch uses Cloudflare's public destination policy.
A hosted verification must exercise that path separately.

Do not enable broad shared caching for authenticated or mutable routes.
Public cache lifetimes, invalidation, prefetch behavior, and media diagnosis
belong to the [performance guide](performance.md). Local browser metrics do not
prove hosted cache hits or account cost reductions.

## Patched dependencies

### Direct strtok3 dependency

`strtok3` is listed in `package.json` although no source file imports it. The
Next server bundle loads it through `file-type`, and the OpenNext Worker build
resolves that import from the project root. pnpm only links a direct
dependency there, so removing the entry fails `pnpm build:cloudflare` with
`Could not resolve "strtok3"`. Keep its version matched to the one `file-type`
locks.

### Next image request isolation

The Next patch addresses image requests that can leave later visitors waiting
indefinitely. When optimizing a local image, `fetchInternalImage` uses a mock
request. Reusing the visitor's socket lets a disconnect leave that mock response
unfinished; later requests for the same size and quality then wait on the
in-flight optimization until the server restarts.

`patches/next@16.3.8.patch`, applied through `patchedDependencies` in
`pnpm-workspace.yaml`, removes `socket: _req.socket`. The mock request receives
its own placeholder socket instead. The reproduction uses aborted cold image requests to expose a pending optimization
that later requests reuse. This patch addresses the local Next server path;
Cloudflare's image delivery requires its own hosted verification.

Next 16.3.8 still contains the original call. On an upgrade:

1. Inspect `fetchInternalImage` for `socket: _req.socket`.
2. If it remains, regenerate the patch with `pnpm patch next@<version>`, using
   the version selected for the upgrade.
3. If it is gone, remove the patch.

`pnpm install` fails when a patch no longer applies, making a forgotten patch
visible during installation. Keep the aborted-request reproduction in mind
when evaluating whether an upstream change resolves the original failure.

### Frontmatter YAML engine

The gray-matter override replaces js-yaml 3 with js-yaml 4, removing its
`argparse` and `sprintf-js` dependency chain. The accompanying
`patches/gray-matter@4.0.3.patch` adapts the YAML engine's `safeLoad` and
`safeDump` calls to `load` and `dump`. Keep the patch paired with the
`gray-matter>js-yaml` override so the engine and its caller agree.

js-yaml 4 uses the same safe default schema; no JavaScript YAML types are
enabled. Remove both the patch and override when gray-matter supports js-yaml
4 upstream.

## Dependency changes and mail routing

Run a fresh dependency audit when changing the lockfile. Inspect scoped overrides
in `pnpm-workspace.yaml` and the patches they require. A previous audit result
cannot establish the current dependency tree's status.

`site.emails` configures the public mail links. Receiving mail also requires
provider routing. Verify delivery separately from rendered `mailto:` links and
legacy web-host redirects.
