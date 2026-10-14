# Independent publishing

A writing belongs first to `willie.page`: it has a source file, a canonical
permalink, and a place in the site's published output. Other services can carry
copies, notify readers, or host a conversation around it. Keeping the original
here gives those connections a stable address even when their clients and
providers change.

## Identity, content, and responses

### Authorize a client, then publish a writing

IndieAuth lets the owner grant a client permission to act on the site's behalf.
Micropub uses that permission to create or change a writing. These are separate
jobs: knowing who authorized a request does not decide which properties a post
contains, and accepting a post does not mean a deployment has made it public.

Client-created writings use the same content model as hand-authored MDX. An
article written in a local editor and a note sent from a Micropub client therefore
reach the same loaders, pages, and feeds. That shared path matters when changing
the writing model: a field must survive editing and source queries as well as
look right on its permalink. The [writing model](../../reference/content/writings.md)
and [IndieWeb contract](../../reference/publishing/indieweb-spec.md) define those
obligations.

### Let readers choose how to follow

Feeds expose published content without requiring an account on another service.
WebSub adds notifications when a feed changes, while Webmentions connect an
outside response to the page it cites. A subscriber and a respondent need
different things; feed delivery cannot establish that a reply was verified or
approved for display.

The [IndieWeb reference](../../reference/publishing/indieweb.md) records each
protocol's endpoints and dependencies. Keep those requirements with the
capability they enable. Creating a first local page should not require setting
up a database or an external publishing identity merely because the site also
supports them.

### Connect external identities without moving the original

Standard.site records on AT Protocol describe the publication and its writings.
Visitors can use their own accounts to subscribe or recommend a published
writing. An explicitly requested Bluesky copy can also carry conversation back
to the original. The [AT Protocol reference](../../reference/publishing/atproto.md)
explains the records, associations, and supported interactions.

For example, editing a writing updates its Standard.site document while retaining
the existing Bluesky announcement text. Those objects serve different purposes:
one describes the current document; the other preserves the announcement people
have already replied to. A local draft creates neither a public writing nor a
Standard.site document through the publishing sync.

## Capability and evidence

### Match the claim to the observation

Source tests can establish that draft filtering works for the inputs they
exercise. A provider receipt can establish that an isolated account accepted a
record. A hosted browser check can establish that the resulting page displayed
it. None supplies the other observations automatically.

Use the [conformance reference](../../reference/publishing/publishing-conformance.md)
to find the dated evidence and its limits. The [verification guide](../../guides/publishing/publishing-verification.md)
explains isolated accounts and cleanup. This distinction lets verification be
thorough without turning test content into an unapproved public release.

### Keep proposed integrations separate

[ActivityPub](./activitypub.md) remains a proposal for discovery, following, and
post delivery. It describes a possible future connection, including work that
would need new state and delivery handling. It does not add a publishing path to
the implemented contract or authorize publishing an authored draft.
