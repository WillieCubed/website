# AT Protocol

The site is an AT Protocol identity and a [standard.site][standard]
publication: every published writing has a signed record in the owner's repo
that Atmosphere readers can find. Design and roadmap: [the Atmosphere
spec](./superpowers/specs/2026-10-02-atmosphere-design.md).

## Configuration

Nothing here is hardcoded: every value comes from the environment, read only
in `lib/site.ts` and `lib/atproto/config.ts`. Each feature turns off when its
values are unset.

| Variable                     | What it is                                                           | Where it must be set          |
| ---------------------------- | -------------------------------------------------------------------- | ----------------------------- |
| `NEXT_PUBLIC_ATPROTO_DID`    | The owner's DID; `/.well-known/atproto-did` serves it                | every environment that builds |
| `NEXT_PUBLIC_BLUESKY_HANDLE` | The handle shown beside the Bluesky account                          | every environment that builds |
| `ATPROTO_PUBLICATION_RKEY`   | The publication's record key, a TID generated once and never changed | every environment that builds |
| `ATPROTO_APP_PASSWORD`       | The app password the post-deploy sync writes with                    | Production only               |

Generate the publication key once, from the repo after `pnpm install`:

```sh
node --input-type=module -e "import { now } from '@atcute/tid'; console.log(now())"
```

Set the output as `ATPROTO_PUBLICATION_RKEY` on every environment that builds
the site, and never change it afterwards.

## Identity

- The site links to the Bluesky profile by DID, so its links survive a
  handle change.
- The handle is whatever domain the DID document names. To move it to this
  site's domain, add `TXT _atproto.<domain> "did=…"` for the DID, change the
  handle in Bluesky, and update `NEXT_PUBLIC_BLUESKY_HANDLE`. Followers and
  posts stay, because they belong to the DID.
- Keep `did:plc`. A `did:web` identity cannot move to another domain or
  recover from losing this one.

## standard.site

| What                                           | Where                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Publication record                             | `site.standard.publication/<ATPROTO_PUBLICATION_RKEY>`, built by `publicationRecord` |
| One document per published writing (notes too) | `site.standard.document/<computed TID>`, built by `documentRecord`                   |
| Verification                                   | `/.well-known/site.standard.publication` returns the publication URI                 |
| Publication tag on every page                  | `<link rel="site.standard.publication">` in `app/layout.tsx`                         |
| Document tag on every writing                  | `<link rel="site.standard.document">` in `app/writings/[slug]/page.tsx`              |

Record keys are computed (`lib/atproto/keys.ts`): the publish time in
microseconds plus a clock ID from the path. **Do not change a writing's
`published` time or slug after it is announced on Bluesky.** The sync would
move the record, but the Bluesky post's card would still point at the old one.

Records leave out `content`, because the site renders its own HTML.
`textContent` holds the full plain text.

[standard]: https://standard.site

## Sync

After every push to `main`, `.github/workflows/indieweb-publish.yml` waits for
the deployment and calls `/api/indieweb/notify`. The handler pings WebSub,
sends webmentions, and then runs `syncAtproto()` (`lib/atproto/sync.ts`):

1. It reads every published writing with the uncached loaders.
2. It builds the publication record and one document per writing. Icons and
   covers are fetched from the live site: `featuredImage` (an empty one counts
   as none), or the generated `opengraph-image`. An image over 1,000,000 bytes
   is left out. When a fetch fails, the record on the PDS keeps the icon or
   cover it already has.
3. It checks every record against its lexicon and stops, writing nothing, if
   one is invalid.
4. It lists this site's records on the PDS and plans the difference
   (`lib/atproto/plan.ts`). It never touches records whose `site` is another
   publication.
5. It uploads the blobs that changed records need, then applies the writes in
   one `applyWrites` call per 200 operations.

The sync is skipped when the DID, the publication key, or
`ATPROTO_APP_PASSWORD` is empty. Without the DID or the publication key the
`<link>` tags and the well-known route turn off too, so no page names a record
the sync would never write. The password is set on Production only, so a
preview deployment never writes. It signs in at the PDS that the DID document
names (`lib/atproto/identity.ts`).

To see what the next sync would do, run
`vercel env pull .env.atproto.local --environment=production`, then
`pnpm atproto:sync`. Run `pnpm atproto:sync --write` to apply it by hand.
`.env.atproto.local` is a dedicated file, not `.env.local`, so production
values never reach `next dev`. It holds production values only, and it is
gitignored (`.env*.local`). A password stored as a Sensitive variable cannot be
pulled; add it to `.env.atproto.local` by hand.

## Checking it

- `https://pdsls.dev/at://<NEXT_PUBLIC_ATPROTO_DID>` shows the records.
- `https://site-validator.fly.dev/` checks a writing's URL end to end: the
  `<link>` tag, the record, the publication, and the well-known route.
- Paste a writing's URL into the Bluesky composer. The card should show the
  publication's icon and name.
