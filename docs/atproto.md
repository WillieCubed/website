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
