# IndieWeb configuration

Maintainers use this reference to configure protocol storage, credentials, and commands. Select the intended environment before running a writer or sender. The [deployment guide](../../guides/operations/deploy.md) owns Worker target selection; `.env.example` documents local configuration.

## Scripts

Select the intended environment before invoking a sender or writer. The table is
a command lookup, not a setup sequence. `atproto:sync` previews unless `--write`
is supplied; moderation approvals and notification commands can change stored
state or deliver to other sites.

| Script                                   | What it does                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm search:index`                      | Also runs as the search stage of `content:prepare`. Writes `public/search-index.json` and the Pagefind index in `public/pagefind/` from published writings and their tags, initiatives and their parts, and pages. Both are gitignored. The Pagefind step needs its platform binary, which the `pagefind` package installs. |
| `pnpm websub:ping`                       | POSTs `hub.mode=publish` to `WEBSUB_HUB` for the six site and writings feeds, `/writings`, and each published tag's page and feeds.                                                                                                                                                                                         |
| `pnpm webmentions:send`                  | Sends webmentions for writings whose content hash changed. Skips itself without a database.                                                                                                                                                                                                                                 |
| `pnpm webmentions:moderate`              | Lists pending webmentions, or approves or rejects them by id; see [moderation](webmention.md#moderation). Approving a reply also attempts [Salmention](webmention.md#salmention). Needs `POSTGRES_URL`.                                                                                                                     |
| `pnpm webmentions:backfill-authors`      | One-off repair for webmentions verified before the verifier read a `u-photo` with alt text: fills each missing author photo from the h-entry stored with the mention, through `extractAuthor`. It writes only rows with no photo, so a second run changes nothing. Without `POSTGRES_URL` it says so and exits 0.           |
| `pnpm atproto:sync`                      | Prints the standard.site writes a sync would make; `--write` makes them. Needs `ATPROTO_APP_PASSWORD`; see [atproto.md](atproto.md).                                                                                                                                                                                        |
| `.github/workflows/indieweb-publish.yml` | Waits for the public alias to serve a pushed revision, then calls the authenticated notification endpoint.                                                                                                                                                                                                                  |
| `pnpm test`                              | Runs the configured unit suite with its preparation hooks and two test workers.                                                                                                                                                                                                                                             |

## Environment variables and bindings

| Variable                                                                                           | Used by                                                                                                                                                                                     | Default                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `POSTGRES_URL` / `DATABASE_URL`                                                                    | webmentions, reply context, activity feeds, Postgres search                                                                                                                                 | unset, features degrade                 |
| `WEBMENTION_MODERATION_SECRET`                                                                     | `/api/webmention/moderate`                                                                                                                                                                  | unset, route refuses                    |
| `OWNER_ACCESS_ISSUER`, `OWNER_ACCESS_AUDIENCE`, `OWNER_ACCESS_EMAIL`                               | owner identity on `/indieauth/consent` and `/admin/*`                                                                                                                                       | unset, owner routes refuse access       |
| `INDIEAUTH_INTROSPECTION_SECRET`                                                                   | `/indieauth/introspect`                                                                                                                                                                     | unset, route answers 503                |
| `STUDIO_GITHUB_REPOSITORY`, `STUDIO_GITHUB_TOKEN`, `STUDIO_GITHUB_BRANCH`, `MICROPUB_CONTENT_PATH` | Micropub and Studio publication                                                                                                                                                             | local write, `main`, `content/writings` |
| `MEDIA_BUCKET` R2 binding                                                                          | `/micropub/media` image, audio, video and PDF storage; `/media/*` delivery                                                                                                                  | absent, upload route answers 503        |
| `INDIEWEB_NOTIFY_SECRET`                                                                           | authenticates the post-deployment notification endpoint                                                                                                                                     | unset, endpoint refuses                 |
| `SKIP_WEBMENTIONS`                                                                                 | `true` skips `webmentions:send`                                                                                                                                                             | unset                                   |
| `INDIEWEB_TEST_ALLOW_LOOPBACK`                                                                     | the local write test only: lets the public-only fetch reach loopback; ignored on Cloudflare                                                                                                 | unset                                   |
| `NEXT_PUBLIC_ATPROTO_DID`                                                                          | `/.well-known/atproto-did`, the Bluesky profile link and syndication target, and (with `ATPROTO_PUBLICATION_RKEY`) the `/.well-known/site.standard.publication` route and its `<link>` tags | unset, all off                          |
| `NEXT_PUBLIC_BLUESKY_HANDLE`                                                                       | the Bluesky account's displayed handle                                                                                                                                                      | unset, the DID is shown                 |
| `ATPROTO_PUBLICATION_RKEY`                                                                         | the standard.site publication: its record, `<link>` tags, and well-known route                                                                                                              | unset, all off                          |
| `ATPROTO_APP_PASSWORD`                                                                             | standard.site sync after each production deploy                                                                                                                                             | unset, sync skipped                     |

Hosted database access also requires `HYPERDRIVE` for public publishing state and
`STUDIO_HYPERDRIVE` for private drafts. Outside Workers, the corresponding direct
URLs are `POSTGRES_URL`/`DATABASE_URL` and `STUDIO_DATABASE_URL`. Keep these stores
separate when preparing local checks. `cloudflare.config.ts` declares the Worker
bindings; its modes select the production and preview resources.

### Migration ordering

Apply public migrations in numeric order from `lib/db/migrations/` before
serving code that uses their tables or functions. No route creates missing
schema. The early migrations establish Webmentions, outgoing delivery, search,
rate counters, IndieAuth, response media, and Salmention. Migrations 006–009
establish refresh families, deletion archives, and code-replay binding.
Inspect the target database's applied migrations before running a migration;
never replay a completed production migration from an old acceptance run.

Private Studio schema is separate from the public IndieWeb migration sequence.
Use the [private writing guide](../../guides/publishing/private-writing.md) and
its actual migration inventory when preparing draft storage; applying only the
Webmention/auth tables does not configure private revisions.
