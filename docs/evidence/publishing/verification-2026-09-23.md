# IndieWeb verification on 2026-09-23

This record is for Willie and the next maintainer changing IndieWeb behavior.
Use it to distinguish the public site's state from the isolated acceptance
site. Repeat the external checks after changing discovery, publishing, or
interaction code.

The production alias `https://willie.page` resolves to Vercel deployment
`dpl_6cVSer7jcLPZx6W3GpXZpcqJbwkJ`. GitHub recorded its Production
deployment for commit `f8769f5e10c97b01737827067df887cfb5e858e8` at
08:36 UTC. Production has no `POSTGRES_URL`, every checked-in writing is a
draft, its writings feeds contain no items, and
`/writings/indiemark-level-3` returns 404. Write checks did not touch it.

The public acceptance origin is
[`https://indieweb-acceptance.vercel.app`](https://indieweb-acceptance.vercel.app).
It uses Vercel project `indieweb-acceptance` and Neon project
`willie-page-indieweb-acceptance`, both separate from production. The local
checkout is based on the production commit above. Disposable writings were
built into the acceptance deployment and were not added to the feature branch.
The final acceptance deployment is `dpl_D3FNft927Yoccz75EoJbGa1tbzin`.
A separate publishing branch, `codex/indieweb-test-publish-20260923`, holds
the Micropub commits. The acceptance site's canonical origin was set with
`NEXT_PUBLIC_SITE_ORIGIN` at build time.

| Check                           | Result                                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository suite                | 420 unit tests passed; lint, typecheck, and build passed | The production build reported existing `::highlight` CSS warnings. IndieWeb postbuild was disabled for the local build.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Public production HTTP          | 7 passed, 1 skipped                                      | [Homepage](https://willie.page/), [writings](https://willie.page/writings), feeds, WebFinger, IndieAuth metadata, and invalid requests passed. The post case skipped because production has no published writing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Acceptance HTTP                 | 8 passed                                                 | The [test writing](https://indieweb-acceptance.vercel.app/writings/indieweb-acceptance-20260923) exposes a parsed author, canonical URL, date, and content. Its entry appears in [JSON Feed](https://indieweb-acceptance.vercel.app/writings/feed/json). Missing and invalid Micropub tokens returned 401 and 403.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Independent microformats parser | Passed                                                   | [Go Microformats Parser](https://go.microformats.io/?url=https%3A%2F%2Findieweb-acceptance.vercel.app%2Fwritings%2Findieweb-acceptance-20260923) returned an `h-entry` with an `h-card` author, permalink, publication date, and content. The [homepage parse](https://go.microformats.io/?url=https%3A%2F%2Findieweb-acceptance.vercel.app%2F) returned the representative `h-card`.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Independent feed validation     | Passed                                                   | The [RSS result](https://validator.w3.org/feed/check.cgi?url=https%3A%2F%2Findieweb-acceptance.vercel.app%2Fwritings%2Ffeed.xml) and [Atom result](https://validator.w3.org/feed/check.cgi?url=https%3A%2F%2Findieweb-acceptance.vercel.app%2Fwritings%2Ffeed%2Fatom) each called the feed valid. Both feeds contain the disposable writing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Micropub storage and deployment | Passed with an isolated publishing branch                | A valid IndieAuth `create` token returned 202 and `Location: https://indieweb-acceptance.vercel.app/writings/indieweb-interoperability-20260923`. The route committed `content/writings/indieweb-interoperability-20260923.mdx` to the publishing branch in commit `4e4b55700478eac6246842bf7ae2770b6a5318ee`. The [permalink](https://indieweb-acceptance.vercel.app/writings/indieweb-interoperability-20260923) now returns 200 and appears in the acceptance feed. The isolated deployment was updated after the commit.                                                                                                                                                                                                                                                                                         |
| Webmention receiving            | Passed                                                   | The [public source](https://raw.githubusercontent.com/WillieCubed/website/codex/indieweb-test-publish-20260923/indieweb-acceptance-source.html) initially linked to the test writing. `POST /webmention` returned 202; Neon recorded a verified reply. It stayed hidden until approval returned 200. The public JSON then counted one reply and the post rendered it. After the source link was removed, another 202 marked the mention deleted and the public JSON count returned to zero. A source without a link was also stored as deleted and never approved.                                                                                                                                                                                                                                                   |
| Webmention Rocks                | Sender discovery #1-23 and receiver #1-2 passed          | The site first sent from the [test writing](https://indieweb-acceptance.vercel.app/writings/indieweb-interoperability-20260923) to [sender test #1](https://webmention.rocks/test/1). The repository's sender then sent from a [disposable public source](https://raw.githubusercontent.com/WillieCubed/website/codex/indieweb-test-publish-20260923/indieweb-sender-source.html) that links to all 23 discovery targets. Every POST returned HTTP 200; tests [#1](https://webmention.rocks/test/1) through [#23](https://webmention.rocks/test/23) list that source. Receiver [test #1](https://webmention.rocks/receive/1) discovered `/webmention` and received 202 without `Location`. Receiver [test #2](https://webmention.rocks/receive/2) received 400 for invalid source, invalid target, and both invalid. |
| WebSub Rocks                    | Publisher discovery passed                               | Its publisher parser found the same hub and self URLs for the acceptance RSS, Atom, site JSON, writings JSON, activity JSON, and per-writing activity JSON feeds. Its subscription to the writings RSS feed received HTTP 202 and reached `active: true`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

The independent [Authorship Rocks](https://authorship.rocks/) site supplies
sample posts for software that discovers authors of _other_ sites. It does
not accept an arbitrary URL to validate this site's post, so its cases do
not apply to the implemented publisher behavior. Webmention Rocks update and
delete cases were not run. The discovery cases
verify the sender's endpoint handling with a public source page, while the
test writing verifies the published-post send route for case #1.

## Micropub Rocks

Email sign-in completed for the test account. Its endpoint discovery found the
authorization, token, and Micropub endpoints on the isolated site. Its
[authorization callback](https://micropub.rocks/endpoints/callback) failed to
obtain a token: the site's token endpoint returned HTTP 400 with
`{"error":"invalid_request","error_description":"code, client_id, redirect_uri, and code_verifier are all required."}`.
Micropub Rocks did not send a PKCE verifier. The site kept the verifier
requirement and used a short-lived, manually registered test token for the
server cases.

Cases [600](https://micropub.rocks/server-tests/600?endpoint=1003) and
[601](https://micropub.rocks/server-tests/601?endpoint=1003) returned HTTP 200
with valid configuration and syndication JSON. Case
[803](https://micropub.rocks/server-tests/803?endpoint=1003) returned HTTP 401
with `{"error":"unauthorized"}` for a missing token. Micropub Rocks marked all
three as passing. Case
[100](https://micropub.rocks/server-tests/100?endpoint=1004) returned HTTP 202
with a `Location` from the tunneled local build. The post landed on the
disposable publishing branch in commit
`b9d9b6387994b273808adda164c484eac0f61363`; its
[permalink](https://indieweb-acceptance.vercel.app/writings/micropub-test-of-creating-a-basic-h-entry)
returned HTTP 200 after the isolated deployment included the commit. The same
case against the Vercel endpoint returned HTTP 500 with
`{"error":"server_error","error_description":"The content directory is read-only (EROFS). Configure MICROPUB_GITHUB_REPO and MICROPUB_GITHUB_TOKEN so posts commit through GitHub instead."}`.
The public Vercel project deliberately has no GitHub publishing token.

Case [804](https://micropub.rocks/server-tests/804?endpoint=1003) used a valid
token without `create` scope. It received HTTP 403 with
`{"error":"forbidden"}`, while Micropub Rocks expects HTTP 401 with
`{"error":"insufficient_scope"}`. The current
[IndieAuth specification](https://indieauth.spec.indieweb.org/#error-responses)
recommends HTTP 403 for insufficient scope, but the site's error code could
name that condition more precisely. Case
[805](https://micropub.rocks/server-tests/805?endpoint=1003) now receives HTTP
400 with `{"error":"invalid_request"}` when the token appears in both the
header and form body. The publishing branch did not change. Micropub Rocks
still marks it failing because it expects the literal error string `bad
request`, whereas the [Micropub error
definition](https://www.w3.org/TR/micropub/#error-response) names
`invalid_request`.

The first tunnel expired while running cases
[101](https://micropub.rocks/server-tests/101?endpoint=1004),
[104](https://micropub.rocks/server-tests/104?endpoint=1004),
[107](https://micropub.rocks/server-tests/107?endpoint=1004),
[200](https://micropub.rocks/server-tests/200?endpoint=1004),
[201](https://micropub.rocks/server-tests/201?endpoint=1004),
[202](https://micropub.rocks/server-tests/202?endpoint=1004),
[203](https://micropub.rocks/server-tests/203?endpoint=1004),
[204](https://micropub.rocks/server-tests/204?endpoint=1004),
[205](https://micropub.rocks/server-tests/205?endpoint=1004), and
[206](https://micropub.rocks/server-tests/206?endpoint=1004). Each received
HTTP 503 with `no tunnel here :(` from the tunnel provider. Those are
unverified cases, not site results. The old Vercel deployment also advertised
`media-endpoint` while `POST /micropub/media` returned HTTP 503 with
`{"error":"temporarily_unavailable"}`. The final isolated deployment omits
the media endpoint from `q=config` until upload storage is configured.

Earlier checks also found and fixed three defects. Before the change, WebSub
Rocks reported `hub: false` and `self: false` for
[`/writings/feed/json`](https://indieweb-acceptance.vercel.app/writings/feed/json),
even though the JSON body contained them. The feed now uses HTTP `Link`
headers, and WebSub Rocks finds both URLs. Before the change,
`POST /api/webmention/send` for the Micropub note returned HTTP 200 with
`{"message":"Sent 0 webmentions, 0 failed.","results":[]}` because it read
Markdown source as HTML. It now extracts Markdown links, returned one
successful send, and Webmention Rocks displayed the source. The initial
published-post parser check also found no `author` property on the `h-entry`.
The post now includes an author card, and the independent parser reads it.
