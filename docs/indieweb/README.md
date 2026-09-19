# IndieWeb

This page is for whoever changes an IndieWeb route, a feed, or a post kind on
this site, Willie or an agent. It lists what the site exposes, which
environment variables switch each part on, and where the site stands against
[IndieMark](https://indieweb.org/IndieMark) levels 1 through 3. When you add
or remove a route, update the tables here and rerun `pnpm test`.

The canonical origin, author name, photo, and social profiles all come from
`lib/site.ts`. Protocol endpoints and the WebSub hub are named once in
`lib/indieweb/constants.ts`. Do not write the hostname anywhere else.

## Routes

| Route                                                              | Purpose                                                                          | Needs                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------- |
| `/webmention` (alias of `/api/webmention`)                         | Receives webmentions, verifies the source, stores them for moderation            | Postgres                          |
| `/webmentions?target=`                                             | Public JSON list of approved webmentions for one page                            | Postgres                          |
| `/api/webmention/send`, `/api/webmention/send-all`                 | Send webmentions for one post or every post; bearer `WEBMENTION_SECRET`          | Postgres, `WEBMENTION_SECRET`     |
| `/activity/feed.xml`, `/activity/feed/atom`, `/activity/feed/json` | Site-wide feed of approved webmention activity; empty without a database         | Postgres (optional)               |
| `/writings/[slug]/activity/feed.*`                                 | Same three formats scoped to one writing                                         | Postgres (optional)               |
| `/micropub`                                                        | `GET ?q=config` and `?q=syndicate-to`; `POST` creates a note or article          | IndieAuth token; see Micropub     |
| `/oembed?url=`                                                     | oEmbed provider for any page on the canonical origin                             | nothing                           |
| `/search?q=`, `/api/search?q=`                                     | Server-rendered search over writings, answered from this domain                  | nothing (Postgres optional)       |
| `/api/search/reindex`                                              | Rebuilds the Postgres search table; returns 503 unless `SEARCH_BACKEND=postgres` | Postgres, `SEARCH_REINDEX_SECRET` |
| `/llms.txt`                                                        | Plain-text map of the site for language-model crawlers                           | nothing                           |
| `/.well-known/webfinger`, `/.well-known/host-meta`                 | Identity discovery for `acct:willie@willie.page`                                 | nothing                           |
| `/.well-known/atproto-did`                                         | Publishes the AT Protocol DID from `site.author.atprotoDid`                      | nothing                           |
| `/feed.xml`, `/feed/atom`, `/feed/json`                            | Site feeds for writings and projects; each declares the WebSub hub               | nothing                           |
| `/writings/feed.xml`, `/writings/feed/atom`, `/writings/feed/json` | Writings-only feeds, advertised from `/writings`                                 | nothing                           |

Every route that says "Postgres" reads `POSTGRES_URL` through
`@vercel/postgres`. Without it the webmention routes return errors and the
activity feeds return empty documents; nothing else on the site notices.

## Markup

Each writing page is an `h-entry` with `p-name`, `p-summary`, `e-content`,
`dt-published`, `dt-updated`, `p-category`, and `u-url u-uid`. No entry
carries a `p-author`: the top bar's link home is `rel="author"`, the head
repeats it as a `<link>`, and the homepage `h-card` has `u-url u-uid` equal
to its own URL, so it is the representative card. That is the authorship
algorithm's documented fallback (indieweb.org/authorship-spec), and it keeps
the author's name off every page that is already under the author's name.
`/writings` is an `h-feed` with its own `p-name` and `u-url`. Notes omit the visible headline; the loader derives
`title` from the first sentence so feeds and the index still have text, and
`WritingHeader` renders that derived title inside an `sr-only` heading.

Post kinds map to these properties in `WritingHeader.tsx` and
`ReplyTarget.tsx`. `docs/content/writings.md` explains the frontmatter.

| Frontmatter   | Property                                   |
| ------------- | ------------------------------------------ |
| `inReplyTo`   | `u-in-reply-to`                            |
| `likeOf`      | `u-like-of`                                |
| `repostOf`    | `u-repost-of`                              |
| `bookmarkOf`  | `u-bookmark-of`                            |
| `rsvp`        | `p-rsvp` plus `u-in-reply-to` on the event |
| `syndication` | `u-syndication`, one per entry             |

`@handle` in prose becomes a link through `lib/writings/remark-mentions.ts`.
`@thewilliediaries` and `@williecubed` map to their Instagram profiles, and any
other handle links to `https://instagram.com/<handle>`. Add an entry to
`MENTION_TARGETS` when a handle lives somewhere else.

## Micropub

`POST /micropub` accepts form-encoded or JSON `h-entry` bodies with a bearer
token. The token is checked against `INDIEAUTH_TOKEN_ENDPOINT` (default
`https://indieauth.com/token`) and must carry the `create` scope and a `me`
on the canonical origin. Requests without a token get 401 and requests with a
bad one get 403.

A valid request becomes an MDX file under `content/writings`. When
`MICROPUB_GITHUB_REPO` and `MICROPUB_GITHUB_TOKEN` are set the file is
committed through GitHub's Contents API on `MICROPUB_GITHUB_BRANCH` (default
`main`) so the post deploys like any hand-written one. Without those variables
the route writes into the local checkout. On a read-only deploy that write
fails with a 500 whose `error_description` names the reason, which is the
correct outcome on Vercel and Workers: set the GitHub variables there.

## Scripts

| Script                                        | What it does                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm search:index` (runs as `prebuild`)      | Writes `public/search-index.json` from published writings. The file is gitignored.          |
| `pnpm websub:ping`                            | POSTs `hub.mode=publish` with the six feed URLs to `WEBSUB_HUB`.                            |
| `pnpm webmentions:send`                       | Sends webmentions for writings whose content hash changed. Skips itself without a database. |
| `scripts/postbuild.mts` (runs as `postbuild`) | Runs the two scripts above only when `INDIEWEB_POSTBUILD=1`, and never fails the build.     |
| `pnpm test`                                   | `tsx --test tests/unit/*.test.mts`                                                          |

## Environment variables

| Variable                                                                                           | Used by                                                     | Default                                 |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| `POSTGRES_URL` / `DATABASE_URL`                                                                    | webmentions, reply context, activity feeds, Postgres search | unset, features degrade                 |
| `WEBMENTION_SECRET`                                                                                | `/api/webmention/send*`                                     | unset, routes refuse                    |
| `INDIEAUTH_TOKEN_ENDPOINT`                                                                         | Micropub token verification                                 | `https://indieauth.com/token`           |
| `MICROPUB_GITHUB_REPO`, `MICROPUB_GITHUB_TOKEN`, `MICROPUB_GITHUB_BRANCH`, `MICROPUB_CONTENT_PATH` | Micropub storage                                            | local write, `main`, `content/writings` |
| `SEARCH_BACKEND`                                                                                   | `postgres` switches search to Postgres                      | JSON index                              |
| `SEARCH_REINDEX_SECRET`                                                                            | `/api/search/reindex` in production                         | unset                                   |
| `INDIEWEB_POSTBUILD`                                                                               | `1` enables the postbuild pings                             | unset, postbuild no-ops                 |
| `SKIP_WEBMENTIONS`                                                                                 | `true` skips `webmentions:send`                             | unset                                   |

The Postgres schema lives in `initializeWebmentionsTable()` in
`lib/indieweb/webmention-storage.ts`, `initializeReplyContextTable()` in
`lib/indieweb/reply-context.ts`, and `lib/db/migrations/001_level4_tables.sql`
for `outgoing_webmentions`, `reply_context_cache`, and `search_index`. Apply
the SQL file with `psql "$POSTGRES_URL" -f lib/db/migrations/001_level4_tables.sql`.

## IndieMark checklist

Status as of 2026-09-18. "Done" means the dev server serves it and a test or a
curl in this repo checks it.

| Level | Criterion                                                  | Status                  | Where                                                                            |
| ----- | ---------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| 1     | Own domain with an h-card                                  | Done                    | `lib/site.ts`, `components/site`                                                 |
| 1     | rel="me" links to profiles that link back                  | Done                    | `site.social` in the footer                                                      |
| 1     | Posts on your own domain with h-entry                      | Done                    | `app/writings/[slug]/page.tsx`                                                   |
| 1     | Posts have permalinks and dates                            | Done                    | `u-url u-uid`, `dt-published`                                                    |
| 2     | Two or more post types                                     | Done                    | article `project-superbloom`, notes `fall-tour-2026-begins`, `indiemark-level-3` |
| 2     | Syndicate copies with links back (POSSE)                   | Done                    | `syndication` frontmatter, `u-syndication`                                       |
| 2     | Reply posts with `u-in-reply-to`                           | Done                    | `indiemark-level-3`                                                              |
| 2     | Send webmentions                                           | Done                    | `lib/indieweb/send-webmention.ts`, `webmentions:send`                            |
| 2     | Receive and display webmentions                            | Done, needs Postgres    | `/webmention`, `WebmentionSection`                                               |
| 2     | Feed autodiscovery on the posts page                       | Done                    | `alternates.types` in `app/writings/page.tsx`                                    |
| 3     | Search results on your own domain                          | Done                    | `/search?q=`                                                                     |
| 3     | Micropub endpoint that creates posts                       | Done                    | `/micropub`                                                                      |
| 3     | Authorship on every post                                   | Done                    | `rel="author"` in `TopBar.tsx` and the head; representative h-card in `Rail.tsx` |
| 3     | Likes, reposts, bookmarks, RSVPs render as h-entry         | Done, no live posts yet | `ReplyTarget.tsx`                                                                |
| 3     | WebSub hub declared in feeds and pinged on publish         | Done                    | `WEBSUB_HUB`, `websub:ping`                                                      |
| 3     | Autolinked mentions                                        | Done                    | `remark-mentions.ts`                                                             |
| 3     | Person tags, photo posts, comment display from other sites | Not done                | see `docs/future/activitypub.md` for what comes after                            |

## Not covered here

There is no IndieAuth authorization server on this site; `indieauth.com`
handles sign-in and token minting for Micropub clients. Nothing federates
over ActivityPub yet; that plan is in `docs/future/activitypub.md`.
