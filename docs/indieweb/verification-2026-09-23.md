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
The final acceptance deployment is `dpl_6NUqaPwf2AiN1j5yN8AwASzYzZSR`.
A separate publishing branch, `codex/indieweb-test-publish-20260923`, holds
the Micropub commits. The acceptance site's canonical origin was set with
`NEXT_PUBLIC_SITE_ORIGIN` at build time.

| Check                           | Result                                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository suite                | 418 unit tests passed; lint, typecheck, and build passed | The production build reported existing `::highlight` CSS warnings. IndieWeb postbuild was disabled for the local build.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Public production HTTP          | 7 passed, 1 skipped                                      | [Homepage](https://willie.page/), [writings](https://willie.page/writings), feeds, WebFinger, IndieAuth metadata, and invalid requests passed. The post case skipped because production has no published writing.                                                                                                                                                                                                                                                                                                                                                  |
| Acceptance HTTP                 | 8 passed                                                 | The [test writing](https://indieweb-acceptance.vercel.app/writings/indieweb-acceptance-20260923) exposes a parsed author, canonical URL, date, and content. Its entry appears in [JSON Feed](https://indieweb-acceptance.vercel.app/writings/feed/json). Missing and invalid Micropub tokens returned 401 and 403.                                                                                                                                                                                                                                                 |
| Independent microformats parser | Passed                                                   | [Go Microformats Parser](https://go.microformats.io/?url=https%3A%2F%2Findieweb-acceptance.vercel.app%2Fwritings%2Findieweb-acceptance-20260923) returned an `h-entry` with an `h-card` author, permalink, publication date, and content. The [homepage parse](https://go.microformats.io/?url=https%3A%2F%2Findieweb-acceptance.vercel.app%2F) returned the representative `h-card`.                                                                                                                                                                              |
| Independent feed validation     | Passed                                                   | The [RSS result](https://validator.w3.org/feed/check.cgi?url=https%3A%2F%2Findieweb-acceptance.vercel.app%2Fwritings%2Ffeed.xml) and [Atom result](https://validator.w3.org/feed/check.cgi?url=https%3A%2F%2Findieweb-acceptance.vercel.app%2Fwritings%2Ffeed%2Fatom) each called the feed valid. Both feeds contain the disposable writing.                                                                                                                                                                                                                       |
| Micropub storage and deployment | Passed with an isolated publishing branch                | A valid IndieAuth `create` token returned 202 and `Location: https://indieweb-acceptance.vercel.app/writings/indieweb-interoperability-20260923`. The route committed `content/writings/indieweb-interoperability-20260923.mdx` to the publishing branch in commit `4e4b55700478eac6246842bf7ae2770b6a5318ee`. The [permalink](https://indieweb-acceptance.vercel.app/writings/indieweb-interoperability-20260923) now returns 200 and appears in the acceptance feed. The isolated deployment was updated after the commit.                                       |
| Webmention receiving            | Passed                                                   | The [public source](https://raw.githubusercontent.com/WillieCubed/website/codex/indieweb-test-publish-20260923/indieweb-acceptance-source.html) initially linked to the test writing. `POST /webmention` returned 202; Neon recorded a verified reply. It stayed hidden until approval returned 200. The public JSON then counted one reply and the post rendered it. After the source link was removed, another 202 marked the mention deleted and the public JSON count returned to zero. A source without a link was also stored as deleted and never approved. |
| Webmention Rocks                | Sender #1 and receiver #1-2 passed                       | The [sender test #1](https://webmention.rocks/test/1) listed the [test source post](https://indieweb-acceptance.vercel.app/writings/indieweb-interoperability-20260923) after the site sent a Webmention and received HTTP 200. Receiver [test #1](https://webmention.rocks/receive/1) discovered `/webmention` and received 202 without `Location`. Receiver [test #2](https://webmention.rocks/receive/2) received 400 for invalid source, invalid target, and both invalid.                                                                                     |
| WebSub Rocks                    | Publisher discovery passed                               | Its publisher parser found the same hub and self URLs for the acceptance RSS, Atom, site JSON, writings JSON, activity JSON, and per-writing activity JSON feeds. Its subscription to the writings RSS feed received HTTP 202 and reached `active: true`.                                                                                                                                                                                                                                                                                                          |

The independent [Authorship Rocks](https://authorship.rocks/) site supplies
sample posts for software that discovers authors of _other_ sites. It does
not accept an arbitrary URL to validate this site's post, so its cases do
not apply to the implemented publisher behavior. [Micropub Rocks](https://micropub.rocks/)
server cases require its email sign-in, which was not completed. The local
and hosted Micropub HTTP checks establish the behavior above, but they are
not a Micropub Rocks conformance result. Webmention Rocks sender cases 2-23
were not run.

Two failures were found and fixed during the run. Before the change, WebSub
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
