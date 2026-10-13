# Maintain Music

This document is for the website maintainer. Use it to deploy and diagnose the
owner's Music editor without publishing private selections.

The owner starts at `/admin`, opens Music, connects Spotify, and selects
playlists. Setup saves privately. Review and Publish bind the public catalog to
one immutable saved revision. Spotify imports never change playlists or publish
new selections.

## Storage and approval

Private Music tables share the studio database. Immutable revisions preserve
both sides of concurrent edits. A separate database role can read only the
approved provider cache. The public page intersects that cache with the
committed `content/music/catalog.json` selection and excludes records older
than 24 hours.

The deployment diagram shows the applications involved in publication and
refresh.

```mermaid
flowchart LR
  Admin[Private Cloudflare studio] --> Database[PostgreSQL service]
  Admin --> GitHub[GitHub repository and CI]
  GitHub --> Public[Public Cloudflare Worker]
  Public --> Database
  Schedule[GitHub Actions scheduler] --> Public
```

The publisher creates one recoverable PR per revision and respects repository
checks and rebase merge protection. Unrelated main changes produce a new
proposal commit. A changed public catalog stops publication for review. The
editor reports Live only when the public proof matches the revision, source
blob hash, and deployed commit or its verified descendant.

## Provider configuration

Spotify app `e454b680b63243c9940fe1173214d8da` uses the exact callback
`https://preview.willie.page/api/studio/music/spotify/callback`. The owner
connects through PKCE with playlist read access. The service encrypts tokens
and retains refresh replacements. Spotify revocation requires reconnecting;
curation remains saved.

`SPOTIFY_CLIENT_ID`, the Music-only `MUSIC_TOKEN_ENCRYPTION_KEY`, and the private
database connection stay server-side. The Music key is separate from the
writing/Lattice key and must remain stable. It is backed up in the maintainer's
macOS Keychain as the `music-token-encryption` service for account
`willie-page`; do not copy it into the repository or command arguments. Both
the private preview and public Workers need this same Music key. The public Worker
uses `MUSIC_PUBLIC_DATABASE_URL` with a read-only role for gallery requests.
Its bearer-authenticated refresh route uses `MUSIC_PRIVATE_DATABASE_URL` and
`MUSIC_CACHE_WRITE_DATABASE_URL` with a role limited to Music provider data.
The owner preview writes approved rows through its existing private Music
database connection during publication. It does not need a second Music
database credential; the public Worker continues to use its restricted roles.
The Worker opens a database connection per request because a PostgreSQL socket
cannot be reused across Worker requests.

## Provision and verify

Prepare a private mode-0600 environment file containing
`STUDIO_DATABASE_URL` and the existing Music key from Keychain as
`MUSIC_TOKEN_ENCRYPTION_KEY`. Run
`pnpm exec tsx scripts/music/provision.mts PRIVATE_ENV PRIVATE_STATE_JSON`.
Keep the state file private during retries. The script applies idempotent
migrations, verifies database isolation, configures both Cloudflare
Workers through the named `williecubed` `cf` profile, and stores the scheduler
secret without printing it. The private Studio uses its existing Cloudflare
Hyperdrive binding; this script sets only its Music encryption secret and does
not copy `SITE_MODE` to production. A Music key rotation must re-encrypt the
saved Spotify grant and update both Workers together; do not replace the secret
alone.

The hourly GitHub workflow remains disabled until repository variable
`MUSIC_REFRESH_ENABLED` is `true`. Verify an authenticated POST to
`https://willie.page/api/music/refresh` before enabling it. Invalid credentials
must return 401. Refresh reads only committed approved IDs. A confirmed private
or removed playlist is suppressed immediately; transient failures retain the
last good result for at most 24 hours.

Run `STUDIO_TEST_DATABASE_URL=... pnpm test` for database integration checks.
Run `MUSIC_E2E=1 node scripts/studio-e2e.mjs` for authenticated admin browser
checks and full desktop/phone captures in both themes. The local harness uses
signed JWTs and an isolated PostgreSQL schema; it has no auth bypass.

## Hosted acceptance remains required

A passing build does not prove Spotify consent, owner eligibility, GitHub token
permissions, or publication. Complete the hosted checklist in the
[launch plan](superpowers/plans/2026-10-12-music-production-launch.md).
Never publish fixture data or choose editorial selections for the owner.
