# Titles and social previews

This page is for anyone adding a page or changing what a page says about
itself in a link preview, Willie or an agent. Read it before writing a
`metadata` export or a `generateMetadata` function. When you finish, run
`pnpm test`; `tests/unit/seo-metadata.test.mts` checks the rule below.

## The rule

Every page sets `og:site_name` to "Willie Chalmers III", and no social title
repeats it. Slack, Discord, Mastodon, and Telegram print the site name above
the title, so a title of "Projects - Willie Chalmers III" reads as the name
twice. X, iMessage, LinkedIn, and Bluesky print the domain instead, so the
title still has to make sense on its own. A part page is "Fall Tour 2026 Part
1: A Boy Goes Back to Dallas", not "Part 1: A Boy Goes Back to Dallas".

| Tag             | Example                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `og:site_name`  | Willie Chalmers III                                                    |
| `og:title`      | Fall Tour 2026 Part 1: A Boy Goes Back to Dallas                       |
| `twitter:title` | Same as `og:title`                                                     |
| `<title>`       | Fall Tour 2026 Part 1: A Boy Goes Back to Dallas · Willie Chalmers III |

The document `<title>` keeps the suffix from the root layout's template,
because browser tabs, bookmarks, and search results show no site name beside
it.

The homepage is the one page whose subject is the name itself. Its social
title is the headline sentence ("Willie Chalmers III builds software and
systems for people.") and its description is the sentence after it, so the
preview never prints the bare name twice.

## How to follow it

Call `pageMetadata()` from `lib/site.ts`. It sets `og:title` and
`twitter:title` to the bare title, repeats the site-level OpenGraph fields
that Next.js would otherwise drop, and leaves the description out when it
only repeats the title, which happens for a short note with no description.

A page with nothing to share, such as the 404 or the 500 page, spreads
`bareSocialMetadata(title)` instead. Without it, Next.js copies the suffixed
document title into `og:title`.

A top-level page reads its label and description from `sitePages` in
`lib/site.ts` through `sitePage(path)`. The page's metadata, its social image,
the hover card, and site search all read that one entry, so they cannot
drift apart.

A part's name away from its initiative comes from `partTitle()` in
`lib/initiatives/index.ts`. Use it anywhere the part appears without the
initiative around it: metadata, search results, and structured data.

## Open questions

Nobody has checked how each platform truncates a long part title such as
"Fall Tour 2026 Part 3: First Adult Wedding, Eh?".
