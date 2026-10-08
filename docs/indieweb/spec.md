# Supported IndieWeb behavior

This contract is for Willie and anyone changing this site's publishing or
interaction code. After a change, run the checks in the last column and record
any interoperability failure before shipping. The route inventory and required
environment variables remain in the [IndieWeb operations guide](README.md).
The [IndieMark criteria and evidence](indiemark.md) map levels 1 through 3 to
tests and public proof. The criteria are draft community guidance; the W3C
protocol requirements below govern wire behavior.

The site publishes at `https://willie.page`. This table describes implemented
behavior when its listed dependencies are configured and content is published.
The [current conformance matrix](../publishing-conformance.md) records external release gates. The September verification records remain historical evidence. Readers and clients must be able to discover
and consume the behavior below from HTTP responses. A unit test alone does
not establish that another IndieWeb implementation can use it.

The source standards are [h-card](https://microformats.org/wiki/h-card),
[h-entry](https://microformats.org/wiki/h-entry), and
[h-feed](https://microformats.org/wiki/h-feed) for HTML;
[Webmention](https://www.w3.org/TR/webmention/) for link notifications;
[IndieAuth](https://indieauth.spec.indieweb.org/) and
[Micropub](https://www.w3.org/TR/micropub/) for client publishing; and
[WebSub](https://www.w3.org/TR/websub/) for feed notifications. The site also
publishes [Atom](https://www.rfc-editor.org/rfc/rfc4287),
[RSS 2.0](https://www.rssboard.org/rss-specification), and
[JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/). This contract records
the subset implemented here. It does not claim that the site passes every
optional or required case in each standard.

| Supported behavior               | Observable contract                                                                                                                                                                                                                                                                                                                | Verification                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Identity and authorship          | The homepage exposes a representative h-card and rel-me identity links. Published entries expose an author h-card, canonical URL, dates and content inside an h-feed.                                                                                                                                                              | Parse rendered HTML and fetch WebFinger.                                          |
| Posts and feeds                  | Article, note, photo, audio, video, reply, like, repost, bookmark, RSVP and event properties survive authoring. Pages and RSS, Atom and JSON Feed carry safe content, media and author identity. Drafts remain excluded.                                                                                                           | Parse actual pages and feeds; inspect media playback and draft exclusion.         |
| Webmention                       | Public HTTP and HTTPS sources may cite distinct same-site pages. Verification resolves document links against the final URL and valid base URL and selects the citing entry. Approved responses retain authorship and safe media. Edits, lost links and deletion refresh stored state.                                             | Run receiving/discovery fixtures, Webmention Rocks and Authorship Rocks.          |
| Moderation, Vouch and Salmention | Responses remain private until approved by the configured policy. Vouch verifies actual referring links. Salmention resends approved responses upstream under the existing throttle.                                                                                                                                               | Verify policy decisions and delivery against independent fixtures.                |
| Micropub                         | Form, multipart and JSON requests preserve nested and multivalued MF2 properties. Authenticated source queries support property filters. Replace/add/remove retain additional properties. Explicit post-status controls drafts. Delete privately archives source; undelete restores its original permalink and rejects collisions. | Exercise authenticated creation, editing, restoration, conflicts and round trips. |
| IndieAuth                        | S256 PKCE, client and redirect binding, single-use codes and token scopes remain enforced. New access tokens last one hour. Refresh tokens rotate as hashed client-bound families with a 90-day inactivity limit. Reuse revokes the family. UserInfo returns only granted profile fields.                                          | Exercise a current PKCE client, rotation, replay, scope limits and UserInfo.      |
| Syndication                      | Micropub advertises the configured Bluesky destination only when Standard publishing can run. Explicit per-writing intent creates one associated copy after the document exists. Existing copies prevent duplicates. Manual Threads and Bluesky sharing remains available.                                                         | Verify real isolated PDS writes, retries and public associations.                 |
| WebSub                           | Feeds advertise hub/self links. Deployment notifications publish changed topics. Hub acceptance and subscriber receipt are recorded separately.                                                                                                                                                                                    | Verify actual subscriber delivery with WebSub Rocks or an independent subscriber. |

The site does not offer Microsub, a feed reader, or ActivityPub delivery. Those
behaviors are outside this contract. The [ActivityPub plan](../future/activitypub.md)
describes possible later work.
Micropub delete archives the original source privately before removing it. Undelete restores the same source and permalink. A conflicting source rejects restoration with 409.

[Authorship Rocks](https://authorship.rocks/) supplies sample posts for sites
that _consume_ authorship data. The webmention verifier now discovers the
authors of external posts, so its cases apply: send each case as a source to
an isolated deployment and compare the stored author with the expected one.
Nobody has run them yet.

## Test environments

The [HTTP test runbook](testing.md) gives the local database and fixture setup.
Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` on the revision
being deployed. Run `pnpm exec playwright test --project=desktop --workers=1` against
its production build. For a hosted read-only check, set
`INDIEWEB_TEST_BASE_URL` to that deployment and run the IndieWeb HTTP suite.
Set `INDIEWEB_TEST_POST_PATH` to the path of a published disposable writing to
enable its permalink assertion.

Write tests require an isolated deployment, database, and publishing branch.
Set `NEXT_PUBLIC_SITE_ORIGIN` to the isolated deployment's public origin at
build time and when running HTTP checks against it. Its canonical URLs,
authentication identity, and feed links must all refer to that deployment.
Keep it unset for `https://willie.page`.
The test source must be reachable by that deployment over HTTPS. Keep test
tokens and database credentials out of the repository. Do not send a valid
Micropub create or Webmention to production as part of the routine suite.

Record the deployment revision, URLs, date, test results, and any cases that
could not run. A `202` response only proves that a request was accepted; it
does not prove that a post was published or a Webmention was verified and
displayed.

## October 7, 2026 additions

Micropub preserves a canonical nested and multivalued MF2 property map through create, authenticated source queries and updates. It supports literal text, safe HTML, explicit drafts, audio/video/events and linked files. Delete commits an exact private source archive before removing the public source. Undelete restores the same source and permalink under a transaction lock and rejects collisions.

IndieAuth refresh credentials rotate as hashed, client-bound families. Replay revokes the family. New access credentials last one hour; refresh inactivity expires after 90 days. UserInfo exposes permitted profile fields. Existing access-token expiry and mandatory S256 PKCE remain unchanged.

Webmention verification accepts public HTTP and HTTPS sources and distinct pages on this site. It resolves actual links against the final response URL and valid HTML base, then selects the citing entry. Approved response media renders through safe native controls. Feed items retain author identity, dates, canonical URLs, full body and attachments. RSS uses a confirmed media size rather than inventing an enclosure length.
