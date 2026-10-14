# Publishing conformance

This record connects the supported publishing behavior to the external checks
performed on October 7–9, 2026. Use it to determine what a release demonstrated,
which environment supplied the evidence, and what still needed an approved
production publication. It is not a fresh inspection of the current deployment.

The site publishes content and displays responses. It does not offer a reader,
Microsub, a hosted personal data server (PDS), relays, or ActivityPub delivery.
Acceptance tooling temporarily provisions a PDS to exercise account behavior;
that test infrastructure is separate from the website's product scope.

Resolve the applicable external checks before describing a new release as fully
interoperable. A successful HTTP request, an actual provider write, a rendered
response, and a subscriber's receipt establish different parts of that claim.
Existing authored drafts remain private unless Willie approves publication.

## Standard.site baseline

### Schema identities inspected on October 7

A schema defines the shape of a record. The inspection pinned the actual schema
records so later readers can distinguish that contract from a newer schema or
client package. Each CID is a content identifier for the inspected version;
it is not the version number of the JavaScript package used to build records.

On October 7, the authoritative schemas were inspected as
`com.atproto.lexicon.schema` records under DID
`did:plc:re3ebnp5v7ffagz6rb6xfei4`, which resolved to
`https://auriporia.us-west.host.bsky.network`. Every record below declared
`lexicon: 1`. The inspected runtime used `@atcute/standard-site` 2.0.2.

| Schema record key                  | Schema CID                                                    |
| ---------------------------------- | ------------------------------------------------------------- |
| `site.standard.publication`        | `bafyreiapvnarfn3nl2wvg27hsylli5zqvou7a74p7od5mu4detprtejapy` |
| `site.standard.document`           | `bafyreifylc5lfr4vqfzrwdtqm4pnfg7cbra7z4acbgikylqandzefwdeaq` |
| `site.standard.graph.subscription` | `bafyreiccyb5e4vq3rwhrajeud72ztezljufzrqbo73vz6mw2jwbgsxfqta` |
| `site.standard.graph.recommend`    | `bafyreibglev4uvatb5do5obqxlif5w6b63tysjb7ve6w44x54g7hfe2rgy` |
| `site.standard.authSocial`         | `bafyreibdamyqel7hurrk66bbpvrqgf6cby3kmpnchvwrkjb5rijgkrdsve` |
| `site.standard.theme.basic`        | `bafyreiabm6f64zosv5jcdmwd3qvekjhoi7enevg53rxj734ney4sd6lmku` |
| `site.standard.theme.color`        | `bafyreicps42z5maxdqwml7t3klsrrpk332jthyfgpeb4zjn3wlvp5vyjia` |

The [document](https://standard.site/docs/lexicons/document/),
[publication](https://standard.site/docs/lexicons/publication/),
[verification](https://standard.site/docs/verification/), and
[permissions](https://standard.site/docs/permissions/) descriptions explain those
records. The inspected document schema has no `langs` field. Its `content` and
`links` fields are open typed union objects: the object's `$type` identifies its
format. In particular, the prose description of `links` does not make that field
an arbitrary list of URLs; the schema still controls its shape.

### Standard.site capability matrix

Standard.site separates the publication, its documents, and visitor social
records. A publication record describes the site; a document record describes
one writing. Subscription and recommendation records belong to the acting
visitor. The matrix follows those responsibilities, with external results from
the recorded acceptance runs.

| Requirement or capability                                                       | Classification                                | Implementation and evidence                                                                                                                                  | External result                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publication `url`, `name`; document `site`, `title`, `publishedAt`              | Required                                      | Existing identity and stable TID algorithm; strict schema validation before writes                                                                           | Real PDS lifecycle passes; restoration retains the same URI/CID                                                                                                                                                                                         |
| Optional publication description, icon, theme                                   | Optional, supported                           | Existing site configuration; signature/MIME/size checks; square icon at least 256px; RGB/RGBA schemas                                                        | Real PDS field comparisons pass; production publication HTTP/PDS agreement passes                                                                                                                                                                       |
| Publication labels and discovery preference                                     | Optional, supported                           | `ATPROTO_PUBLICATION_SETTINGS` supplies self-labels and `preferences.showInDiscover`; omission uses schema default and preserves existing preferences        | Real PDS extension round trips, omission and explicit removal pass                                                                                                                                                                                      |
| Document path, description, tags, update date, cover, readable text             | Optional, supported                           | Writing frontmatter and AST extraction retain code, lists, tables, quotations, and media descriptions; byte and grapheme limits checked                      | Real PDS text/media comparison and field-limit checks pass                                                                                                                                                                                              |
| Contributors, self-labels, typed content, typed links, Bluesky strong reference | Optional, supported                           | `atproto` frontmatter; known union schemas validated; other valid `$type` payloads retained; omission preserves, `null` removes                              | Real PDS extension round trips, omission and explicit removal pass                                                                                                                                                                                      |
| Publication and document public verification                                    | Required for verified discovery/social writes | Well-known publication URI and both head links; target verifier requires exact HTTP/PDS agreement                                                            | Independent Standard.site validator passes all 16 checks on the real isolated document; exact parent cleanup passed                                                                                                                                     |
| Subscription/recommendation creation, recognition and undo                      | Optional, supported                           | Confidential OAuth; server tokens; durable locks; recognizes and removes matching records from other clients                                                 | Eighteen real API checks pass, including subscriptions, recommendations, foreign-client recognition, concurrent actions and undo; exact graph cleanup passes                                                                                            |
| Refresh, cancellation, callback replay, browser isolation, logout               | Required for implemented OAuth                | Five acceptance PostgreSQL integration checks pass, including refresh across instances                                                                       | Normal consent, two-process refresh, cancellation, expiry, callback binding/replay, isolation, five UI failure checks and logout pass; representative final craft review passes                                                                         |
| Explicit Bluesky copies                                                         | Optional, supported                           | Per-writing intent; deterministic document TID; Standard document first; associated document/publication strong refs; retry recovery; immutable announcement | Eleven [real PDS/AppView lifecycle checks](../../evidence/bluesky-live-20261009.json) pass, including concurrent first publication, retry/manual-copy deduplication and unpublish preservation; hosted permalink and source-association proof also pass |
| Native replies, quotes, likes and reposts                                       | Optional, supported                           | Public AppView; minute cache; source identity, threading, media and moderation; independent from verified Webmention storage                                 | Eight hosted checks pass for real replies, media, quotes, reactions and edit/hide/delete refresh; native playback and combined IndieWeb responses pass                                                                                                  |

### OAuth writes, cleanup, and visual review

The social checks needed to establish more than a button changing appearance:
a visitor had to authorize the site through their provider, the requested record
had to appear in their account, and undo had to remove the intended records.
The [October 9 social receipt](../../evidence/atproto-social-live-20261009.json)
records that path with 18 API checks, five UI failure checks, and logout.

The run covered subscriptions and recommendations, concurrent actions,
recognition of records created by another client, browser isolation, and refresh
from two processes. Exact graph and database cleanup passed. A separate
read-only provider inspection found zero tokens issued to the canonical website
client for both owned account DIDs. Because the foreign-token baseline was empty,
this does not prove preservation of populated unrelated provider grants. Expiry
checks changed isolated deadlines instead of waiting for natural expiry.

Visual review supplied a different observation. The run retained 180 full-page
captures across 45 states at 1440px and 390px in both themes. All passed the
corrected, actually invoked color, transition, and overflow checks. An independent
agent inspected 20 representative captures and found no actionable visual defect;
the agent did not inspect all 180 images.

### Hosted responses and positive playback

A response importer can return correct data without the deployed page rendering
or playing its media. The [hosted Atmosphere
receipt](../../evidence/atmosphere-hosted-live-20261009.json) exercises that second
path: eight checks, 20 hosted captures, and four captures with approved IndieWeb
replies on the same writing. Here, Atmosphere responses are replies and reactions
discovered through Bluesky's public AppView, its indexed account view.

An earlier playback wait did not invoke its predicate, so that wait could not
prove playback. The separate corrected probe observed positive audio/video
playback. The run also cleaned up its exact hosted records, mentions, and source
Worker. The outer acceptance run's publication and source cleanup is recorded
separately; the helper's cleanup did not establish that broader result.

### A real repost received through two protocols

Deduplication needs two real inputs and a baseline showing the first input by
itself. A final screenshot with one actor could otherwise mean that one source
never loaded. This receipt records the sequence needed to distinguish those
possibilities.

The [live overlap receipt](../../evidence/atproto-overlap-live-20261009.json)
records the hosted native repost before the incoming source exists. After the
actual Webmention receiver verifies the same actor’s repost and the moderator
approves it, that actor appears once with the retained IndieWeb source. The
receipt includes both independent inputs, the native-only baseline, four overlap
captures at desktop and 390px in both themes, direct review and exact cleanup.
This live case verifies repost overlap. It does not claim cross-protocol
text-reply equivalence or add source-provenance UI.

### Importer failures and public-data limits

An empty response list can mean that nobody responded or that discovery failed.
The fresh Bluesky lifecycle run passed all eleven checks after importer errors
stopped being reported as empty success. A [separate read-only error
check](../../evidence/bluesky-response-error-20261009.json) supplied a real
configured HTTPS endpoint that returned `401`. The importer retained the verified
copy URL and marked its response result incomplete. This establishes its error
handling, not a production AppView outage or a hosted render.

The [Bluesky association
guidance](https://github.com/bluesky-social/atproto/discussions/4978) describes the
external embed association used to find a copy. The importer requests up to 100
thread levels and 1,000 items per paginated response category. Those bounds and
the public AppView constrain what it can observe: public data does not expose
every visitor's private blocks.

Reposts have another limit. `getRepostedBy` returns actors without an event
timestamp or individual repost-record permalink. The site therefore records the
observation time and links to the actor profile. It does not turn the time it
noticed a repost into a claimed time of the repost itself.

## IndieWeb baseline

### Inspected standards

The IndieWeb checks span author identity in HTML, client publishing,
authorization, link notifications, and feed delivery. Microformats2 (MF2) is the
HTML vocabulary: `h-card` describes a person, `h-entry` a post, and `h-feed` a
collection. These are the standard revisions inspected for the October baseline,
not a claim that the linked living specifications remain unchanged.

| Standard                                                                    | Inspected version                          |
| --------------------------------------------------------------------------- | ------------------------------------------ |
| [Micropub](https://micropub.spec.indieweb.org/)                             | IndieWeb Living Standard, July 25, 2020    |
| [IndieAuth](https://indieauth.spec.indieweb.org/)                           | Living specification header, July 11, 2024 |
| [Webmention](https://www.w3.org/TR/webmention/)                             | W3C Recommendation, January 12, 2017       |
| [WebSub](https://www.w3.org/TR/2026/REC-websub-20260602/)                   | W3C Recommendation, June 2, 2026           |
| [Microformats parsing](https://microformats.org/wiki/microformats2-parsing) | Revision 70607, February 8, 2023           |
| [h-entry](https://microformats.org/wiki/h-entry)                            | Revision 70830, July 2, 2025               |
| [h-card](https://microformats.org/wiki/h-card)                              | Revision 70686, May 23, 2024               |
| [h-feed](https://microformats.org/wiki/h-feed)                              | Draft revision 70688, May 23, 2024         |
| [JSON Feed](https://www.jsonfeed.org/version/1.1/)                          | 1.1                                        |
| [Atom](https://www.rfc-editor.org/rfc/rfc4287)                              | RFC 4287                                   |
| [RSS](https://www.rssboard.org/rss-specification)                           | 2.0.11, March 30, 2009                     |

### IndieWeb capability matrix

The implementation and external-result columns deliberately remain separate.
For example, a serializer test can establish safe feed output for its inputs,
while a hosted feed validator establishes what another service fetched from the
deployment. Neither alone establishes a subscriber receiving a changed feed.

| Requirement or capability                                            | Classification                      | Implementation and evidence                                                                                                                                               | External result                                                                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Micropub form, multipart and JSON creation                           | Required                            | Observable tests cover all handlers, authenticated source queries and token errors                                                                                        | Real PKCE client form/multipart/JSON checks pass; Micropub Rocks browser access is denied                                                                |
| Nested/multivalued source, property filtering and replace/add/remove | Required for implemented operations | Canonical MF2 properties survive editing; literal text and sanitized HTML remain distinct                                                                                 | Hosted PKCE client source/filter/replace/add/remove round trips pass                                                                                     |
| Bidirectional natural-language values                                | Required rendering behavior         | Valid `dir`, BDI and BDO survive sanitization; plain text, titles, summaries and feed HTML use independent first-strong direction; metadata stays in page direction.      | 49 behavior checks and four Chromium renders pass; independent Go/PHP parsers preserve directional HTML                                                  |
| Drafts, article/note/photo/audio/video, interactions and events      | Optional, supported                 | Drafts survive create/edit and stay out of public output; recognized fields projected into pages                                                                          | Independent Go/PHP markup parsing and hosted draft/public lifecycle pass                                                                                 |
| Delete and undelete                                                  | Optional, supported                 | Private PostgreSQL archive stores exact source/permalink; transaction locks serialize operations; `.md` and `.mdx` collisions reject restoration/create                   | Hosted delete/undelete preserves all 2,756 source bytes; concurrent restore returns 200/409; cleanup passes                                              |
| IndieAuth PKCE, code exchange, token verification                    | Required                            | S256 remains mandatory; original authorization checks retained                                                                                                            | IndieAuth Rocks: 78 passes, zero failures/warnings; three applicable skips pass separate normal grants; three JWT skips do not apply                     |
| Refresh and UserInfo                                                 | Optional, supported                 | Migrations 006 and 009; one-hour new access tokens, 90-day refresh inactivity, hashed rotating families, replay revocation, client/scope binding; legacy expiry preserved | Normal S256 grants, UserInfo, refresh narrowing/concurrency/replay revocation and cleanup pass; inactivity uses clock fixtures                           |
| Webmention discovery and verification                                | Required                            | Public-address guarded HTTP/HTTPS; same-site distinct pages; DOM links resolved against final/base URLs; citing entry selected; edits/link removal/deletion               | 23 live discovery cases and hosted create/edit/repeat/410 deletion pass                                                                                  |
| Authorship, moderation, Vouch and Salmention                         | Supported extensions                | Existing policies retained; Vouch links honor valid HTML base URLs                                                                                                        | Five Authorship Rocks fixtures, hosted Vouch/moderation and actual Salmention upstream receipt pass                                                      |
| Image, audio, video and PDF uploads                                  | Optional, supported                 | 4MiB limit; MIME/container signature checks; no SVG; contained native media without autoplay or executable embeds                                                         | Four hosted uploads match retained SHA-256 hashes; real playback, no autoplay, four viewport/theme captures and exact blob cleanup pass                  |
| HTML MF2, RSS, Atom and JSON Feed                                    | Supported formats                   | Canonical URL/date/author; full text and safe media; JSON attachments and Atom enclosures; RSS enclosure size uses confirmed HEAD length                                  | Independent Go/PHP hosted MF2 and W3C live RSS/Atom checks pass; parsed live JSON Feed, exact uploaded bytes and one resolved inline PDF attachment pass |
| WebSub topic discovery and publish ping                              | Publisher requirements              | Existing hub/self discovery and deployment ping                                                                                                                           | Real signed RSS receipt and verified unsubscribe pass; explicit publisher trigger, not automatic workflow proof                                          |

## Verified results and release gates

### Standard.site lifecycle and owned identities

The [October 8 lifecycle receipt](../../evidence/standard-site-live-20261008.json)
asks whether synchronizing a writing preserves the right records through change
and recovery. Its 14 checks against the isolated PDS covered creation, edits,
restoration to the same record address (URI) and content identifier (CID), draft
exclusion, stable keys, unchanged repeated syncs, and preservation of records
belonging to other publications. Field comparisons also covered configured
extensions, known union members, readable text/media descriptions, field limits,
omission, explicit removal, and owned-record cleanup.

Those results closed [#156](https://github.com/WillieCubed/website/issues/156)
and [#157](https://github.com/WillieCubed/website/issues/157). They did not supply
the independent document-validator result described below.

The tooling owned the two acceptance accounts. Both completed normal email
confirmation and public AppView federation checks, and final cleanup deactivated
them. The [identity plan](../../superpowers/plans/2026-10-08-acceptance-identities.md)
records ownership and cleanup. A later run needs usable isolated accounts again;
provisioning one would still not establish website OAuth consent, a social write,
or syndication.

### Hosted IndieWeb publishing and validators

The [hosted IndieWeb receipt](../../evidence/indieweb-live-2026-10-08.json)
follows a client from normal S256 PKCE/TOTP authorization through form,
multipart, and JSON Micropub operations. PKCE binds code redemption to the client
that started authorization; TOTP is the owner's authenticator code at consent.
The run also covered authenticated source editing, draft exclusion, exact source
restoration, Webmention links resolved through HTTP redirects and HTML base URLs,
approved media replies, and an upstream Salmention receipt.

Independent Go and PHP parsers fetched the hosted page. W3C validators fetched
hosted RSS and Atom feeds and reported zero errors and warnings. The
[desktop](../../evidence/received-media/received-light-1440.png) and
[390px](../../evidence/received-media/received-dark-390.png) captures show received
image, audio, video, code, quotation, and linked PDF in context. These observations
establish the IndieWeb response path; the Bluesky response path has its own
hosted receipt.

IndieAuth Rocks reported 78 passes with zero failures or warnings. Three optional
JWT cases did not apply because this site issues opaque access tokens. Separate
normally authorized clients passed the three applicable skipped cases: one
registered cross-origin redirect and two client-binding checks. The validator's
cross-origin callback had an expired TLS certificate, and earlier invalid
attempts had consumed codes used by its client-binding cases. No check disabled
TLS validation or weakened PKCE.

Micropub Rocks was inaccessible under the administrator's browser policy during
the run. The independent S256 client exercised the live publishing endpoints
instead. Retain that substitution and its scope when interpreting coverage.

### Fixtures, controlled clocks, and database replay

Some boundaries cannot be exercised by waiting during an acceptance run. The
90-day refresh inactivity checks used a controlled backend clock; preservation
of legacy token expiry also used clock-controlled checks. These establish the
implemented boundary for those inputs, not that a credential remained idle for
90 real days.

The [independent fixture receipt](../../evidence/indieweb-independent-2026-10-08.json)
records five live Authorship fixtures, 23 live Webmention discovery fixtures,
and Go/PHP/W3C checks on component and serializer output. Its feed inputs produced
two warnings, concerning direct-input self URLs and retained BDO text-direction
markup. That fixture result is distinct from the later zero-warning hosted feed
result: the validators did not consume the same inputs in the same way.

The [migration 009 receipt](../../evidence/indieauth-code-replay-20261008.json)
adds eight real PostgreSQL lock checks with controlled grants. It covers both
possible orderings of token issuance and authorization-code replay, plus
preservation of unrelated tokens. These checks establish database behavior under
the tested interleavings; they do not replace normal client consent.

### Subscriber delivery and cleanup

Notification success and subscriber delivery answer different questions. A
signed receipt binds the changed feed bytes to an actual subscription; a
workflow result records that the publisher trigger completed. Retain both
observations without extending either claim to the other.

The [WebSub receipt](../../evidence/websub-rss-receipt-20261008.json) records a
topic-bound challenge, a 1,632-byte changed RSS body with verified SHA-256 HMAC,
matching public feed hash and confirmed unsubscribe. The publisher was triggered
explicitly. This proves delivery through the independent hub; it does not prove
the automatic deployment notification workflow. The [cleanup
receipt](../../evidence/acceptance-final-cleanup-20261008.json) records removal
of the temporary callback, content, rows, receipt table and source alias. It
also records restoration of acceptance protection and 22 public HTTP checks.
Later ATProto runs must retain their own cleanup receipts for any new fixtures.

### Revision-specific source and browser checks

The split stack at `ac0631e` passed all 846 unit tests, lint, TypeScript, the
bounded production build and browser smoke checks in [CI run
37896976167](https://github.com/WillieCubed/website/actions/runs/37896976167).
The record also reports ten targeted Bluesky tests and 17 targeted response
tests passing. Later verifier changes require fresh checks on the final revision being deployed.
Local UI evidence covers 19 subscription states and 15 recommendation states at
1440px and 390px in both themes. Response-format fixtures cover native
audio/video playback, containment and absent autoplay. These renders do not
prove external responses or account writes.

### Independent verification and production publication boundary

The [independent Standard.site
receipt](../../evidence/standard-site-independent-20261008.json) records a real
browser-observed validator result with 16 successful checks. Its
[screenshot](../../evidence/screenshots/standard-site-validator-20261008.jpg)
shows the hosted writing, resolved PDS records, schema validation and matching
publication endpoint. The browser observation matters because the capture helper accepts a supplied
validator report without independently establishing its result. The supplied
report alone would not prove that the validator inspected the live document. The recovery run
removed the source and PDS document, restored or removed the original
publication, preserved foreign records and drained the required notification
workflow. That workflow passed with `synced` on acceptance revision `9014e42`.

The [read-only production
receipt](../../evidence/production-standard-publication-20261008.json) confirms
exact agreement between the publication endpoint and resolved PDS record. That
inspection found zero Standard.site documents on the owner PDS, four authored
drafts in production, and no acceptance writing. Production document and
recommendation verification therefore remained dependent on an approved real
publication. Isolated acceptance established those behaviors without making an
authored draft public.

### Schema rollout and final notification

The October 9 verification found migrations 005–009 on acceptance and
production. The [production migration
receipt](../../evidence/production-publishing-migration-20261009.json) records
atomic application of 006–009 and a ready schema. All seven original fields of
the one legacy access-token row, including its exact expiry, remained unchanged.

The [final notification and cleanup
receipt](../../evidence/acceptance-notification-final-20261009.json) records the
clean acceptance revision `4d0ff1f9a76010ff429c84b9917fa6da4416297c` and fixture
`404`. Its [push
notification](https://github.com/WillieCubed/website/actions/runs/37919522943)
and [dispatched
notification](https://github.com/WillieCubed/website/actions/runs/37919577933)
both returned `synced`. The outer acceptance run waited for its notification
handlers to finish before completing exact PDS cleanup, so a late handler could
not recreate a record after its removal. Historical missing-identity and deployment-quota failures do not
describe this final run. The independent signed WebSub subscriber receipt
remains separate from notification success.

## Verification work tracking

The October 9 audit records acceptance evidence for all five verification epics
and their sixteen subtasks. It also records why an apparently complete result
needed another run: the earlier hosted capture did not establish native/IndieWeb
overlap, so the audit reopened Bluesky #163/#166. A fresh hosted native-only
baseline followed by the actual incoming repost supplied the missing sequence.

The audit records production deployment, required synchronization, and public
checks passing on `1ba27df040ef489751d1a0be940125235ec65e82`. The table below
summarizes that dated work; earlier receipts retain their own narrower scopes
and cleanup results.

### October 9 verification work

| Area                   | Epic                                                      | Current evidence                                                                                                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard.site          | [#155](https://github.com/WillieCubed/website/issues/155) | Fourteen lifecycle/extension checks and 16 independent validator checks pass. Exact parent cleanup and final notification sync pass.                                                                                                                                                     |
| Visitor social actions | [#159](https://github.com/WillieCubed/website/issues/159) | Normal authorization, refresh, 18 API checks, five UI failure checks, logout and exact cleanup pass. The 180 guarded captures and final craft review of 20 representative images pass.                                                                                                   |
| Bluesky                | [#163](https://github.com/WillieCubed/website/issues/163) | Eleven PDS/AppView lifecycle checks, eight hosted checks and positive playback pass. Hosted and combined-response captures retain separate proof and cleanup. The fresh native-only hosted baseline and real overlapping repost pass #166 with five reviewed captures and exact cleanup. |
| IndieWeb               | [#167](https://github.com/WillieCubed/website/issues/167) | Authorization, publishing, response, parsed live feed, native playback, exact media hashes and cleanup pass.                                                                                                                                                                             |
| WebSub                 | [#173](https://github.com/WillieCubed/website/issues/173) | Real challenge, signed subscriber receipt, unsubscribe and temporary-resource cleanup pass.                                                                                                                                                                                              |

### Final cleanup and production observation

The [final infrastructure
cleanup](../../evidence/acceptance-infrastructure-cleanup-20261009.json) removed
the four owned acceptance configuration entries and publication, deactivated
both accounts, and removed the owned Workers, tunnel and PDS container.

The [focused history
receipt](../../evidence/publishing-focused-history-20261009.json) verifies
twelve implementation and verification PRs landed on main with one commit each
and successful required CI. The documentation PR records the release state
separately.

The [earlier quota
receipt](../../evidence/production-rollout-blocked-20261009.json) retains the
rejected production attempts. The [October 9 production
receipt](../../evidence/production-publishing-live-20261009.json) records a
ready deployment of `1ba27df040ef489751d1a0be940125235ec65e82`, successful
required notification with `atproto.status: "synced"` and 29 public checks.
In that run, OAuth/discovery endpoints were accessible without a firewall
challenge, HTTP/PDS publication verification agreed, all three feeds contained
zero writings, and ten acceptance fixture URLs returned `404`. No authored draft was published.
Production document verification remains the first approved real-publication
check.
