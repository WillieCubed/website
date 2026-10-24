# IndieWeb

The owner publishes through [Micropub](micropub.md), grants clients access through [IndieAuth](indieauth.md), and receives outside responses through [Webmention](webmention.md). Maintainers use the references below to look up each protocol without reading unrelated lifecycle rules.

[Independent publishing](../../concepts/publishing/independent-publishing.md) explains the relationships. The [supported behavior contract](indieweb-spec.md) defines observable obligations. Use the [HTTP guide](../../guides/publishing/indieweb-testing.md) for local verification and the [publishing verification guide](../../guides/publishing/publishing-verification.md) for hosted acceptance.

## IndieWeb discovery and routes

- <a id="routes"></a> [Routes](indieweb-discovery.md#routes)

- <a id="database-dependent-routes"></a> [Database-dependent routes](indieweb-discovery.md#database-dependent-routes)

- <a id="current-release-contract"></a> [Current release contract](indieweb-discovery.md#current-release-contract)

## Microformats

- <a id="markup"></a> [Markup](microformats.md#markup)

- <a id="entries-author-cards-and-feed-shells"></a> [Entries, author cards, and feed shells](microformats.md#entries-author-cards-and-feed-shells)

- <a id="post-kinds-and-index-projections"></a> [Post kinds and index projections](microformats.md#post-kinds-and-index-projections)

- <a id="reply-content-and-safe-media"></a> [Reply content and safe media](microformats.md#reply-content-and-safe-media)

- <a id="reactions-and-rsvp-answers"></a> [Reactions and RSVP answers](microformats.md#reactions-and-rsvp-answers)

- <a id="mentions-without-a-reaction"></a> [Mentions without a reaction](microformats.md#mentions-without-a-reaction)

- <a id="keep-responses-inside-the-parsed-entry"></a> [Keep responses inside the parsed entry](microformats.md#keep-responses-inside-the-parsed-entry)

- <a id="initiative-events-and-prose-handles"></a> [Initiative events and prose handles](microformats.md#initiative-events-and-prose-handles)

## Webmention

- <a id="moderation"></a> [Moderation](webmention.md#moderation)

- <a id="approval-and-visibility"></a> [Approval and visibility](webmention.md#approval-and-visibility)

- <a id="moderation-endpoint-and-state-changes"></a> [Moderation endpoint and state changes](webmention.md#moderation-endpoint-and-state-changes)

- <a id="receiving"></a> [Receiving](webmention.md#receiving)

- <a id="targets-and-canonical-addresses"></a> [Targets and canonical addresses](webmention.md#targets-and-canonical-addresses)

- <a id="fetch-an-untrusted-source"></a> [Fetch an untrusted source](webmention.md#fetch-an-untrusted-source)

- <a id="select-the-response-and-its-author"></a> [Select the response and its author](webmention.md#select-the-response-and-its-author)

- <a id="acceptance-deferred-verification-and-rate-limits"></a> [Acceptance, deferred verification, and rate limits](webmention.md#acceptance-deferred-verification-and-rate-limits)

- <a id="sending"></a> [Sending](webmention.md#sending)

- <a id="vouch"></a> [Vouch](webmention.md#vouch)

- <a id="audit-automatic-approvals"></a> [Audit automatic approvals](webmention.md#audit-automatic-approvals)

- <a id="why-trust-accepted-deliveries"></a> [Why trust accepted deliveries](webmention.md#why-trust-accepted-deliveries)

- <a id="salmention"></a> [Salmention](webmention.md#salmention)

- <a id="avoid-notification-loops"></a> [Avoid notification loops](webmention.md#avoid-notification-loops)

- <a id="outgoing-delivery-retries"></a> [Outgoing delivery retries](webmention.md#outgoing-delivery-retries)

- <a id="distinguish-absence-from-failure"></a> [Distinguish absence from failure](webmention.md#distinguish-absence-from-failure)

## Micropub and media

- <a id="micropub"></a> [Micropub](micropub.md#micropub)

- <a id="authentication-and-request-formats"></a> [Authentication and request formats](micropub.md#authentication-and-request-formats)

- <a id="creation-citations-and-stable-slugs"></a> [Creation, citations, and stable slugs](micropub.md#creation-citations-and-stable-slugs)

- <a id="choose-the-source-store"></a> [Choose the source store](micropub.md#choose-the-source-store)

- <a id="source-queries"></a> [Source queries](micropub.md#source-queries)

- <a id="category-queries"></a> [Category queries](micropub.md#category-queries)

- <a id="updates"></a> [Updates](micropub.md#updates)

- <a id="preserve-edits-and-reject-races"></a> [Preserve edits and reject races](micropub.md#preserve-edits-and-reject-races)

- <a id="deletes"></a> [Deletes](micropub.md#deletes)

- <a id="archive-before-removal"></a> [Archive before removal](micropub.md#archive-before-removal)

- <a id="syndication"></a> [Syndication](micropub.md#syndication)

- <a id="media"></a> [Media](micropub.md#media)

- <a id="photo-descriptions-and-placement"></a> [Photo descriptions and placement](micropub.md#photo-descriptions-and-placement)

- <a id="validation-and-playback-limits"></a> [Validation and playback limits](micropub.md#validation-and-playback-limits)

- <a id="storage-and-existing-urls"></a> [Storage and existing URLs](micropub.md#storage-and-existing-urls)

## Owner authorization

- <a id="indieauth"></a> [IndieAuth](indieauth.md#indieauth)

- <a id="identity-discovery"></a> [Identity discovery](indieauth.md#identity-discovery)

- <a id="authorization-and-single-use-codes"></a> [Authorization and single-use codes](indieauth.md#authorization-and-single-use-codes)

- <a id="consent-presentation"></a> [Consent presentation](indieauth.md#consent-presentation)

- <a id="token-endpoints-and-operator-inspection"></a> [Token endpoints and operator inspection](indieauth.md#token-endpoints-and-operator-inspection)

- <a id="owner-sign-in"></a> [Owner sign-in](indieauth.md#owner-sign-in)

- <a id="bot-challenges"></a> [Bot challenges](indieauth.md#bot-challenges)

- <a id="refresh-and-userinfo"></a> [Refresh and UserInfo](indieauth.md#refresh-and-userinfo)

- <a id="refresh-families-and-scope"></a> [Refresh families and scope](indieauth.md#refresh-families-and-scope)

- <a id="identity-only-grants-and-code-replay"></a> [Identity-only grants and code replay](indieauth.md#identity-only-grants-and-code-replay)

## IndieWeb configuration

- <a id="scripts"></a> [Scripts](indieweb-configuration.md#scripts)

- <a id="environment-variables-and-bindings"></a> [Environment variables and bindings](indieweb-configuration.md#environment-variables-and-bindings)

- <a id="migration-ordering"></a> [Migration ordering](indieweb-configuration.md#migration-ordering)

<a id="indiemark-evidence"></a>

[IndieMark](indiemark.md) and [publishing conformance](publishing-conformance.md) distinguish supported behavior from dated external observations.

<a id="not-covered-here"></a>

ActivityPub remains a [proposal](../../concepts/publishing/activitypub.md).
