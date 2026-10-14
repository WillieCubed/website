# Production writing review

Willie must approve a writing's exact text and dates before it becomes public on
`willie.page`. Review the draft, resolve factual and authorship questions,
obtain approval, then set `draft: false` for the intended publishing deployment.

Protocol tests use disposable posts, called fixtures, on the isolated acceptance
site. Those posts do not require editorial approval. Production checks need an
approved original because the test would publish words under Willie's name. The
draft-specific questions below identify what remains to review.

## Fall Tour 2026

### Reconcile the copy with the publication date

`content/writings/fall-tour-2026-begins.mdx` says the tour “starts today” on
September 18, 2026. Check the date and the underlying event before publishing it
later. Ask Willie whether to preserve a dated account of the start or write a
later announcement. “Today” must refer to the day the published copy describes.

### Restore syndication only for an actual copy

The former `syndication` field pointed at an Instagram profile and was removed.
A profile identifies an account, not this post's outside copy. Add the copy's
permalink only after it exists and links back to the exact original. Verify the
links in both directions so the metadata describes a real relationship.

## Two candidates for the first public posts

### Testing independent publishing

`content/writings/testing-independent-publishing.mdx` is an unpublished account
of the isolated protocol checks. Review its first-person wording and proposed
publication date with Willie. Confirm that each account of a test identifies the
environment and result that were actually observed. First-person copy also needs
Willie's review: an accurate test report can still attribute experiences or
conclusions he has not approved.

### IndieMark checklist

`content/writings/indiemark-checklist.mdx` replaces the false level 3 claim in
`indiemark-level-3.mdx`. It replies to the IndieMark page and leaves the public
claim open. Check both its first-person account and its reply target.

The reply criterion concerns a response received by another site. Sending a
Webmention is the notification step; the destination still has to accept or show
it. Check whether the IndieMark page has a working receiver before relying on
that draft to demonstrate the criterion. If that target cannot provide it, an
approved reply to a site with a working receiver may be necessary. Do not
strengthen the claim to make the checklist appear complete.

## Project Superbloom

### Finish the article before considering publication

`content/writings/project-superbloom.mdx` contains unfinished paragraphs and
spelling errors. Keep it a draft. If the shorter candidates are not approved,
write and approve other originals rather than using this unfinished article as
production test material. Test urgency does not resolve authorship or accuracy.

## Manual syndication

### Link the original and its outside copy

Use an existing account for manual syndication. The outside copy must link to
the exact `willie.page` post; add its permalink to the original's `syndication`
field after checking that backlink. For a thread reply, inspect where the copy
appears: it counts as a reply only under the parent's copy on that account. A
link to the right account alone proves neither the copy nor its thread position.
