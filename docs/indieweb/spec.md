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
The [verification record](verification-2026-09-23.md) says which parts are
active on the current deployment. Readers and clients must be able to discover
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

| Supported behavior      | Observable contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Verification                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and authorship | The homepage parses as one representative `h-card` with the canonical URL, name, and photo. Profile links use `rel="me"`. A post has a parsed `p-author h-card` and links to the homepage with `rel="author"`. WebFinger resolves `acct:willie@willie.page` to the profile and protocol endpoints.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Parse rendered HTML and fetch WebFinger in the HTTP suite. Check a published post with an independent microformats parser.                                                                                                                                                                                                       |
| Posts and feeds         | A published writing has a canonical `h-entry` with permalink, publication date, content, and the properties for its post kind. The writings and initiatives indexes expose `h-feed`. RSS, Atom, and JSON Feed advertise their own URL and contain published content only. Drafts never appear in a production feed or permalink.                                                                                                                                                                                                                                                                                                                                                                                                                             | Unit checks cover post-kind markup and feed serialization. The HTTP suite parses a published fixture and fetches every feed. Compare its permalink and date in an independent feed reader or parser.                                                                                                                             |
| Webmention sending      | After a post deploys, the sender discovers each target's current endpoint and submits the public source and target. An update resends to old targets even if the link was removed, as well as to new targets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Unit checks cover discovery, target history, and request data. Use Webmention Rocks sender and update cases from a published test post and inspect the receiver's recorded result.                                                                                                                                               |
| Webmention receiving    | The endpoint accepts only a valid source URL and an existing canonical site target. It fetches the source, verifies a link, and stores the parsed interaction. A missing source or removed link deletes the mention. Only verified, approved mentions appear in the public response, activity feed, or rendered page.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Unit checks cover validation, verification, deletion, moderation, and parsed display. An isolated HTTP test must send a real source, approve it, and observe the public JSON and page. Run Webmention Rocks receiver cases.                                                                                                      |
| IndieAuth and Micropub  | The site advertises its own IndieAuth metadata, authorization endpoint, and token endpoint. Micropub creates a note, photo, article, reply, like, repost, bookmark, or RSVP only with an unexpired `create` token for this profile. The token may be in a bearer header or one form field; both together are invalid. A successful create returns `Location`, writes content through the configured storage path, and yields a published permalink after deployment. A missing token receives 401; an invalid token receives 401 `invalid_token`; insufficient scope receives 403 `insufficient_scope`. The `media-endpoint` appears only when upload storage is configured. Syndication targets remain unadvertised until the site can create copies there. | Unit checks cover authorization, token lifecycle, both credential placements, media, storage, and conditional discovery. The HTTP suite checks discovery and rejection. An isolated write test must obtain a token, create a post, and verify the commit, permalink, and feed entry. Run applicable Micropub Rocks server cases. |
| WebSub publishing       | Each RSS and Atom feed advertises its hub and self URL in XML. Each JSON Feed advertises them in HTTP `Link` headers. A successful deployment triggers a publish notification only after the public alias serves its revision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Unit checks cover feed output, revision gating, and the ping request. The HTTP suite fetches the feeds and checks JSON headers. Run WebSub Rocks publisher discovery and subscription against the test deployment.                                                                                                               |

The site does not offer Microsub, a feed reader, or ActivityPub delivery. Those
behaviors are outside this contract. The [ActivityPub plan](../future/activitypub.md)
describes possible later work.
Micropub update, delete, undelete, and source queries are not implemented.
They are recommended but not required for a Micropub server. The site does not
advertise an editing capability.

[Authorship Rocks](https://authorship.rocks/) supplies sample posts for sites
that _consume_ authorship data. It does not validate an arbitrary post URL, so
its cases apply if this site later implements author discovery for external
posts.

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
