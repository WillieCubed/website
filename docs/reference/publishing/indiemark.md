# IndieMark criteria

Maintainers use the [IndieMark criteria](https://indieweb.org/IndieMark) to
review public independent-publishing capabilities. The criteria are draft
guidance and include unresolved items. Before claiming a level, collect current
public examples rather than treating implemented endpoints or an old isolated
acceptance run as a public result.

## Repeatable checks

The checks below distinguish available code from behavior a reader can use.
POSSE means publishing on your own site and syndicating elsewhere. Its evidence
requires both the original post and the exact outside copy.

| Level | Testable criterion                                                      | Repeatable check                                                                                                                                         |
| ----- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Own domain and use it as an identity for sign-in                        | Fetch the homepage, `rel=me`, IndieAuth metadata, and complete a PKCE authorization on an isolated deployment                                            |
| 1     | At least two original, indexable HTML posts with permalinks and h-entry | Fetch two approved posts without JavaScript, parse each with an independent microformats parser, check robots and site search                            |
| 2     | Representative homepage h-card with name, URL, photo, and icon          | Parse the public homepage with an independent parser; fetch the photo and manifest icon                                                                  |
| 2     | Two real post types, including a note                                   | Parse approved article and note permalinks and their feeds                                                                                               |
| 2     | Navigate and search public posts                                        | Follow previous/next links and query `/search?q=` for a published phrase                                                                                 |
| 2     | POSSE copies link back and the originals link to the copies             | Publish a copy from an existing account, follow its link to the original, and parse the original's exact `u-syndication` permalink                       |
| 2     | Minimal posting action for POSSE                                        | Open the Threads composer from an original post; check that it contains the post text and canonical URL                                                  |
| 2     | Link to or preview outside content in notes                             | Render a note with a bare URL and an `@` handle, follow both links, and inspect any embedded outside resource                                            |
| 3     | A reply post reaches another site's Webmention receiver                 | Publish an approved `u-in-reply-to` post, send its Webmention after deployment, and inspect the receiver                                                 |
| 3     | A syndicated reply stays in the corresponding outside thread            | Post a reply under a copy of its parent on an existing account and record both copy permalinks                                                           |
| 3     | Feed subscribers receive updates after publication                      | Check hub/self discovery, subscribe with an independent WebSub tool, publish a post, and confirm delivery after the public alias serves the new revision |
| 3     | Search results use this domain                                          | Query `/search?q=` for a published phrase and check result links                                                                                         |

## Claim only the observed public capability

The site also receives moderated Webmentions and offers Micropub. Those
capabilities do not replace missing public posts, syndicated copies, or
subscriber delivery. The [supported protocol contract](indieweb-spec.md) owns
implemented behavior, and [conformance boundaries](publishing-conformance.md)
define the evidence needed for a new release.

A profile URL identifies an account. A copy permalink identifies the particular
post and lets a reader verify its link back to the original. The owner must
publish a manual Threads copy and record that exact permalink. Micropub can
request the configured automatic Bluesky destination through explicit
per-writing intent. Check both directions of that association before counting a
POSSE example.

The [archived criteria record](https://github.com/WillieCubed/website/blob/566f37b570df167f917f20217ee6fcd5131d12a8/docs/reference/publishing/indiemark.md)
contains earlier observations. Those dates do not establish the current public
post inventory or a current IndieMark level.
