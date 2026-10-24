# Publishing conformance boundaries

Maintainers use this reference to decide which evidence a publishing change
needs. The [supported IndieWeb contract](indieweb-spec.md) and
[AT Protocol reference](atproto.md) define implemented behavior. A local test,
hosted check, provider readback, and independent validator answer different
questions. None establishes the others.

## Select evidence for the changed contract

| Area                         | Local evidence                                                                                  | Additional hosted or external evidence                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Identity and microformats    | Parse rendered author, entry, feed, and event markup                                            | An independent parser reads the deployed canonical URLs                                               |
| Micropub                     | Request formats, scopes, source round trips, conflicts, private/public storage separation       | An authorized client saves/reopens private source and follows approved publication through deployment |
| IndieAuth                    | PKCE, redirects, code spending/replay, refresh rotation, scope, UserInfo                        | A real client completes normal consent and token exchange on the intended issuer                      |
| Webmention                   | Source selection, public-fetch restrictions, moderation, sanitization, update/delete handling   | The deployed receiver verifies real independent source URLs and renders the approved result           |
| Vouch and Salmention         | Link verification, policy, throttle, and loop prevention                                        | Independent sources establish actual referring links and upstream receipt                             |
| Feeds and WebSub             | Serialized authorship, full content, attachments, and discovery                                 | A subscriber receives the changed topic; hub acceptance alone does not establish delivery             |
| Standard.site                | Publication/document schemas, identity, extensions, source association, and retry rules         | PDS readback agrees with well-known discovery and the public permalink                                |
| Visitor AT Protocol actions  | Session state, locks, stale-request handling, and undo                                          | Real authorization creates the intended records and undo removes those exact records                  |
| Bluesky copies and responses | Explicit syndication intent, association, imports, incomplete-state handling, and deduplication | Actual PDS/AppView records, deployed responses, playback, and overlap inputs are observed             |
| Media                        | Signature/size checks, descriptions, immutable keys, HEAD/conditional/range responses           | Upload and byte delivery work through the intended binding, and cleanup removes only owned objects    |

Use the [publishing verification guide](../../guides/publishing/publishing-verification.md)
for target preparation, ownership journals, external actions, and cleanup. The
[HTTP guide](../../guides/publishing/indieweb-testing.md) owns local protocol test
setup. [IndieMark](indiemark.md) is a separate community capability checklist.

## Preserve the meaning of each outcome

A 202 proves acceptance, not final publication or display. A successful merge
proves a repository change, not the public revision. A record readback proves
what the provider stores, not that a page renders or plays it. A notification
endpoint's success does not establish subscriber delivery. Report each outcome
beside the revision, target, observation time, and unavailable cases.

For response overlap, retain a native-only baseline and then deliver the actual
Webmention input before checking deduplication. A final screenshot with one
actor cannot show whether both inputs arrived. For playback, observe a playback
position change rather than only the presence of controls.

An empty importer result differs from an incomplete result. Preserve a verified
copy URL when response discovery fails. Public AppView data does not expose all
private moderation choices. Repost observations have no provider event timestamp
or individual repost permalink; record observation time and actor identity
without claiming the time of the original repost.

## Keep historical acceptance separate

The retired Vercel acceptance runs and their cleanup remain available in the
[archived conformance record](https://github.com/WillieCubed/website/blob/566f37b570df167f917f20217ee6fcd5131d12a8/docs/reference/publishing/publishing-conformance.md).
They provide cases to repeat, not current Cloudflare acceptance. There is no
current hosted acceptance runner in this tree. Establish the intended Worker,
Access identity, isolated records, and cleanup path before a new run.

Production publication still requires approval of the actual authored text and
dates. Isolated acceptance never authorizes publishing an existing draft.
