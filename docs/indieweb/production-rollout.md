# Production IndieWeb rollout

This record is for Willie before publishing on `willie.page`. Review the
[exact draft text](publication-review.md), enroll the production IndieAuth
secret in an authenticator, and approve the posts that should become public.
The [isolated acceptance record](verification-2026-09-23-followup.md) contains
the tested URLs and outside responses.

On September 23, 2026 PDT, I created Neon project
`willie-page-indieweb-production` (`icy-sound-09771903`) in `aws-us-west-2`.
The database has the base Webmention table and migrations 001–003. The Vercel
`website` project has its own public Blob store
`willie-page-indieweb-production`, production database URL, site origin,
IndieAuth owner secret, Webmention moderation and send secrets, and a
repository-scoped Micropub token. The token grants Contents write to
`WillieCubed/website` only and expires on September 23, 2027. Vercel has the
production notification secret. GitHub does not yet have its matching secret,
so the production workflow skips outbound sends until the read-only smoke
checks pass. The production publishing branch is `main`. The app has not yet
deployed the new protocol revision.

The isolated site proved that a Micropub note committed to its publishing
branch, deployed without a manual rebuild, appeared in the feed, and reached
a WebSub Rocks subscriber. Its media upload and moderated Webmention flows
also passed. A production smoke test still needs the verified code revision,
approved public posts, a read-only check of search and feeds, and a real
outside reply. Manual syndication needs an actual outside copy permalink in
both directions. The site must not claim IndieMark level 3 until those public
checks pass.

The production TOTP secret is new. Willie must add it to an authenticator
before using the IndieAuth consent screen. No production Micropub test post
should be created before the content review, because that post would become
public on `willie.page`.
