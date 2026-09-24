# IndieMark criteria and evidence

This record is for Willie and whoever maintains `willie.page`. Check each
public result before claiming an IndieMark level. The
[IndieMark page](https://indieweb.org/IndieMark) remains a draft and includes
`TBD` items, so those items are not testable claims. Protocol details follow
the [supported behavior contract](spec.md).

| Level | Testable criterion                                                      | Repeatable check                                                                                                                                         | Public state (2026-09-23 unless noted)                                                        |
| ----- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1     | Own domain and use it as an identity for sign-in                        | Fetch the homepage, `rel=me`, IndieAuth metadata, and complete a PKCE authorization on an isolated deployment                                            | Domain and discovery live; independent client authorization still needs a current PKCE client |
| 1     | At least two original, indexable HTML posts with permalinks and h-entry | Fetch two approved posts without JavaScript, parse each with an independent microformats parser, check robots and site search                            | Pending; every production writing is a draft                                                  |
| 2     | Representative homepage h-card with name, URL, photo, and icon          | Parse the public homepage with an independent parser; fetch the photo and manifest icon                                                                  | Passed on production on 2026-09-24; see evidence below                                        |
| 2     | Two real post types, including a note                                   | Parse approved article and note permalinks and their feeds                                                                                               | Pending approved publication                                                                  |
| 2     | Navigate and search public posts                                        | Follow previous/next links and query `/search?q=` for a published phrase                                                                                 | UI exists; public post proof pending                                                          |
| 2     | POSSE copies link back and the originals link to the copies             | Publish a copy from an existing account, follow its link to the original, and parse the original's exact `u-syndication` permalink                       | Pending manual publication; profile URLs do not count                                         |
| 2     | Minimal posting action for POSSE                                        | Start a copy from an original post with a prepared outside compose form or an account integration; inspect the resulting copy permalink                  | Not implemented; copy text and the permalink are handled manually                             |
| 2     | Link to or preview outside content in notes                             | Render a note with a bare URL and an `@` handle, follow both links, and inspect any embedded outside resource                                            | URL and handle rendering tested locally; no public note demonstrates it yet                   |
| 3     | A reply post reaches another site's Webmention receiver                 | Publish an approved `u-in-reply-to` post, send its Webmention after deployment, and inspect the receiver                                                 | Isolated sender discovery passed; public reply pending                                        |
| 3     | A syndicated reply stays in the corresponding outside thread            | Post a reply under a copy of its parent on an existing account and record both copy permalinks                                                           | Pending manual publication                                                                    |
| 3     | Feed subscribers receive updates after publication                      | Check hub/self discovery, subscribe with an independent WebSub tool, publish a post, and confirm delivery after the public alias serves the new revision | Isolated RSS delivery passed with WebSub Rocks; production recheck pending                    |
| 3     | Search results use this domain                                          | Query `/search?q=` for a published phrase and check result links                                                                                         | Search route exists; public post proof pending                                                |

The site also receives moderated Webmentions and offers Micropub creation. Those
capabilities exceed several level 1–3 criteria, but their existence does not
replace a missing public post, actual syndication copy, or hub delivery.

The [Go Microformats parser](https://go.microformats.io/?url=https%3A%2F%2Fwillie.page%2F)
returned one `h-card` from the production homepage on 2026-09-24. Its `name`
was `Willie Chalmers III`, its `url` was `https://willie.page/`, and its
`photo` was `https://willie.page/brand/social/avatar-400.png`. The photo
returned HTTP 200 as a 400 × 400 PNG. The
[web manifest](https://willie.page/manifest.webmanifest) returned HTTP 200
and listed a [192 × 192 PNG icon](https://willie.page/brand/web/icon-192.png),
which also returned HTTP 200. This proves the Level 2 identity criterion on
the public domain. It does not establish the post, syndication, or search
criteria.

We chose manual POSSE for now because neither Bluesky nor Threads publishing
is integrated with Micropub. We rejected profile URLs as copy links because
they do not identify a syndicated post. A working account integration with an
exact created-post URL would justify advertising that account as a Micropub
syndication target.
