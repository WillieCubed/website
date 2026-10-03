# willie.page in the Atmosphere

Date: 2026-10-02. Status: proposed. Implementation plans:

- Phases 0 to 2: [2026-10-02-standard-site.md](../plans/2026-10-02-standard-site.md)
- Phase 3: [2026-10-02-bluesky-posse.md](../plans/2026-10-02-bluesky-posse.md)

## Why

[standard.site](https://standard.site) is the shared AT Protocol lexicon set
for long-form publishing. Leaflet, pckt, Offprint and GreenGale write it, and
readers and indexes (the Leaflet reader, read.pckt.blog, docs.surf) discover
it from the network. Since May 2026, Bluesky reads it to draw richer, verified
link cards.

Publishing `site.standard.*` records gives every writing a signed, portable
entry in the Atmosphere while the site stays canonical. It is the AT Protocol
counterpart to the IndieWeb stack the site already runs (feeds, Webmention,
Micropub, IndieAuth) and to the planned ActivityPub work in
[docs/future/activitypub.md](../../future/activitypub.md).

## Where things stand (checked 2026-10-02)

- **Identity.** A `did:plc` DID, served from `/.well-known/atproto-did`.
  On 2026-10-02 it was hardcoded in `lib/site.ts`; it now comes from
  `NEXT_PUBLIC_ATPROTO_DID`. Its PDS is a bsky.network host, resolved from
  the DID document.
- **The handle is `williecubed.me`.** It resolves through
  `TXT _atproto.williecubed.me`, which was added on 2026-10-02.
  - willie.page has no `_atproto` TXT record and is not in `alsoKnownAs`.
  - So `https://bsky.app/profile/willie.page`, which `site.syndication`
    links to, is a "profile not found" page.
- **Repo.** It holds `app.bsky.*`, `sh.tangled.actor.profile` and
  `sh.tangled.publicKey` records. There are no `site.standard.*` records.
- **Content.** All four writings in `content/writings/` are drafts, so there
  is nothing to publish until the first one ships.
- **Code.** There are no `@atproto/*` or `@atcute/*` dependencies. A
  post-deploy hook already exists: `.github/workflows/indieweb-publish.yml`
  waits for the deployment, then calls `POST /api/indieweb/notify`, which
  pings WebSub and sends webmentions.

## Decisions

1. **One publication** whose `url` is `site.origin` (`https://willie.page`),
   at the domain root.
2. **Every published writing becomes a `site.standard.document`**, notes and
   interaction posts included (Willie, 2026-10-02). Drafts never do.
   Initiatives come later.
3. **Record keys are computed, not stored.** The lexicons require TIDs, and
   the community validator rejects anything else (proposal
   [lexicons#7](https://tangled.org/standard.site/lexicons/issues/7) is still
   open).
   - The publication key is a TID generated once and kept in
     `ATPROTO_PUBLICATION_RKEY`. It never changes.
   - A document's key is `TID(published in µs, fnv1a(path) & 1023)`.
   - The build can therefore emit the `<link>` tags with no network call and
     no database.
4. **The PDS is the source of truth.** There is no Postgres table. A sync
   lists the site's own records, diffs them against content, and writes only
   what changed.
   - It deletes only documents whose `site` is this publication. Records
     another app wrote (Leaflet, for example) are never touched.
5. **`content` is left out. `textContent` carries the full plain text.** The
   site renders its own HTML, and readers link out to it. The only
   standard-looking Markdown block, `site.standard.content.markdown`, is not
   official.
6. **The client library is `@atcute/*`** (client, password-session, tid, cid,
   lexicons, atproto, standard-site).
   - It is ESM and fetch-based, so it ports to Workers when the site leaves
     Vercel.
   - `@atcute/standard-site` ships typed schemas with no code generation step.
   - `@atproto/api` now points new projects at `@atproto/lex`, which is still
     0.x.
7. **Writes authenticate with an app password** in `ATPROTO_APP_PASSWORD`,
   set on production only.
   - When it is empty the sync skips, following the repo's convention.
   - A preview or acceptance deployment has no password, so it cannot
     rewrite the real publication. No origin is hardcoded to enforce that.
   - The sync signs in at the PDS that the DID document names. No sign-in
     host is written down.
8. **The sync runs from the post-deploy hook**, after WebSub and webmentions.
   It can also be run by hand with `pnpm atproto:sync`, which defaults to a
   dry run. Records land after the deployment that serves their `<link>`
   tags, so verification passes on the first fetch.
9. **Announcing on Bluesky is opt-in per post**, through the `syndicateTo`
   field that Micropub already writes (Willie, 2026-10-02).
10. **Comments come from the announce post's thread**, read from the public
    AppView. They do not come from Bridgy backfeed.
    - This avoids duplicates.
    - Moderation stays where the thread lives: hidden replies and threadgates
      are respected.
11. **The handle stays `williecubed.me` for now** (Willie, 2026-10-02), set
    by its `_atproto` DNS record.
    - The site links to the Bluesky profile by DID, so its links survive any
      handle change.
    - The site keeps serving `/.well-known/atproto-did`, so moving the
      handle to the site's domain later is one TXT record, a Bluesky
      setting, and a new `NEXT_PUBLIC_BLUESKY_HANDLE`.
    - Nothing in the AT Protocol work depends on which domain the handle is.
    - Keep `did:plc`, and never use `did:web` for identity: it cannot migrate
      or recover from losing the domain.
12. **Nothing deployment-specific is hardcoded inside the app** (Willie,
    2026-10-02).
    - The DID, handle, origin, record keys, credentials and API endpoints
      all come from the environment.
    - Only `lib/site.ts` (public values) and `lib/atproto/config.ts`
      (server-only settings) read it.
    - The PDS is resolved from the DID document.
    - Each feature turns off when its values are unset.
    - Tests read fixture values from `tests/unit/test.env` and derive their
      expectations from config.

## Roadmap

### Phase 0: Willie, no code

1. Done on 2026-10-02: the handle `williecubed.me` resolves through
   `TXT _atproto.williecubed.me`.
2. Set `NEXT_PUBLIC_ATPROTO_DID` and `NEXT_PUBLIC_BLUESKY_HANDLE` on every
   Vercel environment that builds the site. The identity fix requires them.
   Later, set `ATPROTO_PUBLICATION_RKEY` (generated once; see the plan) and
   `BLUESKY_APPVIEW_URL` (Phase 3) the same way.
3. Create an app password named `willie.page sync`. Add it to Vercel as
   `ATPROTO_APP_PASSWORD` for the **Production** environment only.
4. Sign in at https://pdsls.dev, open `app.bsky.actor.profile/self`, add
   `"website": "https://willie.page"`, and save. The Bluesky app cannot edit
   this field yet.
5. Make sure the Vercel Firewall does not challenge `/.well-known/*`,
   `/writings/*/opengraph-image` or `/brand/social/*`. Indexers, validators,
   and the sync's own image fetches all come from datacenter IPs.
6. Optional, any time: to move the handle to willie.page, add
   `TXT _atproto.willie.page "did=<the DID>"`, then go to Bluesky Settings,
   then Account, then Handle, and enter `willie.page`. Then update
   `NEXT_PUBLIC_BLUESKY_HANDLE`. Followers and posts stay, because they
   belong to the DID.

### Phase 1: PR "atproto identity" (detailed plan)

- Add Bluesky to `site.social`, linked by DID. That puts a `rel="me"` link in
  the footer, adds it to the JSON-LD `sameAs`, and exposes it through the
  palette and MCP.
- The broken `bsky.app/profile/willie.page` link was fixed on 2026-10-02,
  ahead of this PR. The same fix moved the DID and handle into
  `NEXT_PUBLIC_ATPROTO_DID` and `NEXT_PUBLIC_BLUESKY_HANDLE`.
- Add a "Share on Bluesky" post action.
- Add an `atproto` commit scope.

### Phase 2: PR "standard.site publishing" (detailed plan)

- Typed record builders, computed record keys, and
  `/.well-known/site.standard.publication`.
- `<link rel="site.standard.publication">` on every page, and
  `<link rel="site.standard.document">` on every writing.
- A reconciling sync, run from the post-deploy hook and from
  `pnpm atproto:sync`.

### Phase 3: PRs "Post to Bluesky" and "Bluesky responses" ([plan](../plans/2026-10-02-bluesky-posse.md))

The plan refines these points:

- The announcement post takes the document's own record key, so a retried sync never posts twice.
- Quote posts show as mentions.
- Only direct replies are shown; the rest of the conversation stays on Bluesky.
- The work ships as two PRs: posting (Tasks 8 to 10) and responses (Tasks 11 and 12).

- **Read `syndicateTo`.** The writings loader starts reading it.
- **Announce opted-in posts.** For a post that opts in and whose record has no
  `bskyPostRef`, the sync:
  1. creates an `app.bsky.feed.post` with an `app.bsky.embed.external` card:
     `uri`, `title`, `description`, `thumb` (the cover blob), and
     `associatedRefs` (strongRefs to the document and the publication);
  2. calls `putRecord` on the document to add `bskyPostRef`, with
     `swapRecord` set.

  The records point at each other, so this order is forced.

- **Hand-posted copies count.** A `bsky.app` post URL already in a post's
  `syndication` frontmatter becomes its `bskyPostRef`, resolved with
  `app.bsky.feed.getPosts`.
- **Post text.** An article posts its title. A note posts its own text,
  clipped to 300 graphemes. Edits never post again, and posts are never
  edited: Bluesky deliberately freezes cards.
- **Syndication link.** The page renders a `u-syndication` link from
  `bskyPostRef`. It reads its own record with `getRecord` inside
  `'use cache'` with `cacheTag('atproto')`, and the notify route revalidates
  that tag after each sync.
- **Comments.** Call `app.bsky.feed.getPostThread` on
  `https://public.api.bsky.app`.
  - Drop hidden replies (threadgate `hiddenReplies`), replies labelled
    `!hide` or `!warn`, and blocked or missing nodes.
  - Map the replies, likes and reposts into `WebmentionGroup`, so
    `WebmentionSection` renders one list of responses as h-cite.
  - Cache with `cacheLife('minutes')`, like `loadWebmentions`.
- **Reply on Bluesky.** Add a "Reply on Bluesky" action whenever a post
  exists.
- **No Bridgy backfeed** for willie.page, because it would duplicate the
  thread.

### Phase 4: PR "Subscribe and recommend" (optional; own plan)

- **OAuth client.** An atproto OAuth confidential client
  (`@atcute/oauth-node-client`):
  - client metadata at `/oauth-client-metadata.json`, plus JWKS;
  - sessions in Postgres (migration `005`);
  - scope `atproto include:site.standard.authSocial`.

  This is unrelated to the IndieAuth metadata at
  `/.well-known/oauth-authorization-server`.

- **Subscribe** writes `site.standard.graph.subscription`, with
  `{ publication }` set to this publication, into the visitor's own repo. The
  Leaflet and pckt readers then show willie.page in that visitor's feed.
- **Recommend** writes `site.standard.graph.recommend` (`{ document }`) the
  same way.
- **Counts** come from the Constellation backlink index
  (`blue.microcosm.links.getBacklinksCount`).
- **App passwords.** This phase is also when to revisit app passwords.

### Backlog (each a small PR when wanted)

- Initiatives and their parts as documents, using the same builder with
  `/initiatives/...` paths.
- `content` as `at.markpub.markdown`, so readers can render a whole post.
- "Mentioned on Bluesky": use Constellation backlinks to find posts that embed
  a writing's URL, beyond the announce post.
- Tangled repos (`sh.tangled.repo`) on `/projects`, and teal.fm
  `fm.teal.feed.play` now-playing on `/now`, once those pages are routed.
  Read them through Slingshot.
- Smoke Signal events (`community.lexicon.calendar.event`) for talks, and a
  Linkat board mirrored from `site.social`.
- MCP: return each writing's document AT-URI from the writing tools.
- `page.willie.*` lexicons with `_lexicon` DNS records, but only once a custom
  record type exists.
- **Not doing:**
  - `did:web` identity;
  - a labeler;
  - a firehose consumer, because Jetstream needs a long-lived worker;
  - WhiteWind, which is unmaintained and superseded.

## Risks

- **Changing a post's `published` time or slug changes its record key.** The
  sync moves the record and carries `bskyPostRef` over, but an existing
  Bluesky post's `associatedRefs` still point at the deleted record. The rule
  is not to change `published` after announcing.
- **The spec is young.** Open questions include TID-only keys (#7), trailing
  slashes (#13) and the `links` union (#17). All record shaping lives in
  `lib/atproto/records.ts`, so a spec change touches one file.
- **App passwords are deprecated in favour of OAuth**, but they still work.
  Revisit in Phase 4.
- **Vercel's Security Checkpoint challenged plain `curl`** after about ten
  requests on 2026-09-19. If it challenges handle resolution, verifiers, or
  the sync's image fetches, the handle shows as invalid and verification
  fails. That is the reason for Phase 0, step 5.
- **Two document tags can appear in the client-side head.** Soft navigation
  keeps the previous page mounted, so `<head>` can briefly hold two
  `site.standard.document` links. Crawlers never soft-navigate, so
  verification is unaffected, but nothing client-side should read the tag.
