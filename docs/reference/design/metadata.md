# Titles and social previews

Use `pageMetadata()` from `lib/site.ts` for page titles and social previews.
A social title must identify its subject when separated from the page and must
not append the site name. Browser document titles keep the site suffix because
they appear in a different context.

Run `pnpm test` after changing metadata.
`tests/unit/seo-metadata.test.mts` checks the contract described here; external
services' rendering and truncation require their own evidence.

## The rule

### Give each preview one useful title

Every page sets `og:site_name` to “Willie Chalmers III.” Its social title does
not repeat that name as a suffix. Slack, Discord, Mastodon, and Telegram print
the site name above the title, so “Projects - Willie Chalmers III” makes the
preview say the name twice. X, iMessage, LinkedIn, and Bluesky print the domain
instead. A title must therefore work both with a separate site name and
without one.

A part needs the initiative's name because the surrounding initiative page
will be absent from the preview. “Fall Tour 2026 Part 1: A Boy Goes Back to
Dallas” names both the larger work and the part; “Part 1: A Boy Goes Back to
Dallas” leaves the recipient to discover what it belongs to. The extra context
is useful content, unlike an appended site credit.

| Tag             | Example                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `og:site_name`  | Willie Chalmers III                                                    |
| `og:title`      | Fall Tour 2026 Part 1: A Boy Goes Back to Dallas                       |
| `twitter:title` | Same as `og:title`                                                     |
| `<title>`       | Fall Tour 2026 Part 1: A Boy Goes Back to Dallas · Willie Chalmers III |

### Keep the document title's suffix

The document `<title>` retains the suffix from the root layout's template.
Browser tabs, bookmarks, and search results do not provide a separate
`og:site_name` beside it, so the suffix identifies the site in those contexts.
Supply a bare title to the helper and let the template perform that job; putting
the suffix into the input would also send it into the social title.

### Let the homepage describe its subject

The homepage's subject is Willie himself. Its social title is the headline
sentence, “Willie Chalmers III builds software and systems for people.” Its
description is the sentence after it. The headline includes the name as part
of a statement about his work, rather than showing a bare name below the same
name again. Preserve that distinction when revising the headline.

## How to follow it

### Use the helper for a shareable page

`pageMetadata()` sets `og:title` and `twitter:title` to the bare title and
repeats the site-level OpenGraph fields that a page-level metadata object would
otherwise replace. This is a repository contract implemented in `lib/site.ts`:
callers provide the page's facts, while the helper preserves the shared shape.
Writing a one-off social object makes each page responsible for remembering
that shared information.

The helper omits a social description when it only repeats the title. A short
note without a separate description can use its own text as its title, so
printing it again would add a second copy rather than context. The page's
ordinary description remains available for search results.

For pages with nothing of their own to share, such as the 404 and 500 pages,
spread `bareSocialMetadata(title)` instead. That helper supplies bare social
titles; leaving them implicit would let the suffixed document title become the
social title.

### Read top-level labels from their common source

Top-level pages get their label and description from `sitePages` in
`lib/site.ts` through `sitePage(path)`. Their metadata, social image, hover card,
and site search all read that entry. A change to the label should therefore
happen there, where every representation of the destination can agree.

A mismatch is more than a cosmetic inconsistency. If the hover card promises
one page name and the shared preview uses another, a visitor has to decide
whether they are looking at the same destination. A shared source removes that
unnecessary uncertainty.

### Use a part's contextual title away from its initiative

`partTitle()` in `lib/initiatives/index.ts` supplies a part's name when it
appears without its initiative around it. Use it for metadata, search results,
and structured data. A heading inside the initiative can rely on its visible
surroundings; a search result or social preview cannot. Keeping this distinction
in the helper prevents each caller from constructing its own slightly different
version of the full title.

## Open questions

Platform truncation of long part titles remains unverified, including
“Fall Tour 2026 Part 3: First Adult Wedding, Eh?” A unit test can establish the
metadata string the site emits, but it cannot establish where a particular
service cuts the visible preview or how its client lays out the card.

Record the platform and observed result when that check is performed. Until
then, retain the complete contextual title and describe truncation as an open
question; shortening it without evidence could remove the very context this
contract protects.
