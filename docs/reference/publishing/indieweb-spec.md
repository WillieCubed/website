# Supported IndieWeb behavior

A publishing client should be able to discover this site's endpoints, publish
with the owner's permission, and retrieve the resulting public content. A
response from another site should be verified before it appears here. This
contract defines those supported behaviors and the checks needed when they
change.

The [IndieWeb reference](indieweb.md) supplies endpoint and configuration details.
The [conformance boundaries](publishing-conformance.md) identify the additional
interoperability evidence each change needs, and [IndieMark criteria](indiemark.md) concern community capability levels.
These serve different purposes: a recorded validator pass does not expand the
implemented contract, and an IndieMark level does not replace a protocol
requirement.

The contract applies when the listed dependencies are configured and content is
published. Clients must be able to discover and consume the behavior through
actual HTTP responses; a unit test alone cannot establish interoperability.

## Standards and the implemented subset

Microformats2 (MF2) describes content through HTML classes: an `h-card` identifies
a person, an `h-entry` a post, and an `h-feed` a collection of posts. That lets
clients read the same pages people use instead of requiring a separate content
API for every format.

The source standards are [h-card](https://microformats.org/wiki/h-card),
[h-entry](https://microformats.org/wiki/h-entry), and
[h-feed](https://microformats.org/wiki/h-feed) for HTML;
[Webmention](https://www.w3.org/TR/webmention/) for link notifications;
[IndieAuth](https://indieauth.spec.indieweb.org/) and
[Micropub](https://www.w3.org/TR/micropub/) for client publishing; and
[WebSub](https://www.w3.org/TR/websub/) for feed notifications. The site also
publishes [Atom](https://www.rfc-editor.org/rfc/rfc4287), [RSS
2.0](https://www.rssboard.org/rss-specification), and [JSON Feed
1.1](https://www.jsonfeed.org/version/1.1/). This contract records the subset
implemented here. It does not claim that the site passes every optional or
required case in each standard.

## Observable behavior and verification

Read each row as a supported operation and its observable result. Optional
features listed here are implemented, but their protocol standards may not
require every publisher to offer them. Use the verification column to select the
checks affected by a change; retain external results with the release that ran them.

| Supported behavior               | Observable contract                                                                                                                                                                                                                                                                                                                                                                                                                            | Verification                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Identity and authorship          | The homepage exposes a representative h-card and rel-me identity links. Published entries expose an author h-card, canonical URL, dates and content inside an h-feed.                                                                                                                                                                                                                                                                          | Parse rendered HTML and fetch WebFinger.                                          |
| Posts and feeds                  | Article, note, photo, audio, video, reply, like, repost, bookmark, RSVP and event properties survive authoring. Pages and RSS, Atom and JSON Feed carry safe content, media and author identity. Drafts remain excluded.                                                                                                                                                                                                                       | Parse actual pages and feeds; inspect media playback and draft exclusion.         |
| Webmention                       | Public HTTP and HTTPS sources may cite distinct same-site pages. Verification resolves document links against the final URL and valid base URL and selects the citing entry. Approved responses retain authorship and safe media. Edits, lost links and deletion refresh stored state.                                                                                                                                                         | Run receiving/discovery fixtures, Webmention Rocks and Authorship Rocks.          |
| Moderation, Vouch and Salmention | Responses remain private until approved by the configured policy. Vouch verifies actual referring links. Salmention resends approved responses upstream under the existing throttle.                                                                                                                                                                                                                                                           | Verify policy decisions and delivery against independent fixtures.                |
| Micropub                         | Form, multipart and JSON requests preserve nested and multivalued MF2 properties. Authenticated source queries support property filters. Replace/add/remove retain additional properties. Explicit post-status controls private Studio drafts without a public-file fallback. Public-file delete privately archives source; undelete restores its original permalink and rejects collisions.                                                   | Exercise authenticated creation, editing, restoration, conflicts and round trips. |
| IndieAuth                        | S256 PKCE, client and redirect binding, single-use codes and token scopes remain enforced. New access tokens last one hour. Refresh tokens rotate as hashed client-bound families with a 90-day inactivity limit. Reuse revokes the family. Authorization-code replay also revokes the associated family and cannot race token issuance. Scope-free redemption returns identity without a token. UserInfo returns only granted profile fields. | Exercise a current PKCE client, rotation, replay, scope limits and UserInfo.      |
| Syndication                      | Micropub advertises the configured Bluesky destination only when Standard publishing can run. Explicit per-writing intent creates one associated copy after the document exists. Existing copies prevent duplicates. Manual Threads and Bluesky sharing remains available.                                                                                                                                                                     | Verify real isolated PDS writes, retries and public associations.                 |
| WebSub                           | Feeds advertise hub/self links. Deployment notifications publish changed topics. Hub acceptance and subscriber receipt are recorded separately.                                                                                                                                                                                                                                                                                                | Verify actual subscriber delivery with WebSub Rocks or an independent subscriber. |

## Boundaries of the contract

Microsub, a feed reader, and ActivityPub delivery are outside this contract. The
[ActivityPub proposal](../../concepts/publishing/activitypub.md) describes possible
later work rather than an available publishing path.

Micropub deletion is supported, but it removes the public source while retaining
an exact private archive. Undelete restores that source at its original permalink
and returns 409 if another source now occupies the address. This is recovery of
a post, not cleanup of every photo or outside copy that ever referred to it.

Authorship verification also has a specific direction. [Authorship
Rocks](https://authorship.rocks/) supplies sample posts for software that consumes
other sites' author data. Those cases apply to this site's Webmention verifier:
submit a case to an isolated deployment and compare the stored author with the
expected author. Repeat the relevant cases after changing the verifier and retain the result
with that release. The [conformance boundaries](publishing-conformance.md)
explain the limits of a local fixture or outside validator.

## Test environments

### Checks on the release revision

The [HTTP test runbook](../../guides/publishing/indieweb-testing.md) gives the
local database and fixture setup. Run `pnpm test`, `pnpm lint`, `pnpm
typecheck`, and `pnpm build` on the revision being deployed. Run `pnpm exec
playwright test --project=desktop --workers=1` against its production build. For
a hosted read-only check, set `INDIEWEB_TEST_BASE_URL` to that deployment and
run the IndieWeb HTTP suite. Set `INDIEWEB_TEST_POST_PATH` to the path of a
published disposable writing to enable its permalink assertion.

### Isolate writes and identity

A test deployment needs its own public origin as well as its own database.
Otherwise a correctly implemented discovery link can still send a client to the
wrong identity, and a harmless fixture request can become a production mutation.

Write tests require an isolated deployment, database, and publishing branch. Set
`NEXT_PUBLIC_SITE_ORIGIN` to the isolated deployment's public origin at build
time and when running HTTP checks against it. Its canonical URLs, authentication
identity, and feed links must all refer to that deployment. Keep it unset for
`https://willie.page`. The test source must be reachable by that deployment over
HTTPS. Keep test tokens and database credentials out of the repository. Do not
send a valid Micropub create or Webmention to production as part of the routine
suite.

### Record outcomes beyond acceptance

Record the deployment revision, URLs, date, test results, and any cases that
could not run. A `202` response only proves that a request was accepted; it does
not prove that a post was published or a Webmention was verified and displayed.
