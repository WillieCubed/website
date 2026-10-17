# Profile pages

The site has no About or Research page. Earlier drafts of both, and the older
parked profile pages, were removed from the source; git history keeps them for
reference.

On October 11, 2026, Willie deferred Research while academia is on the
backburner. Do not resume it without a new request. A future About page focuses
on his current work and omits a research section.

Implementation approval does not grant permission to publish personal profile
content. An About or Research page needs Willie's approval of its copy and its
public release before it is routed, listed in `sitePages`, or added to any
discovery source.

When one is built, draw its claims from public records:
`lib/site/identity.ts` for the identity sentence and organizations,
`lib/home/focuses.ts` for focus lines, `lib/home/ventures.ts` for work names and
descriptions, and `content/media` through
`getMediaMentions({ includeDrafts: false })` for coverage.
