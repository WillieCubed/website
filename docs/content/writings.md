# Writings

This page is for whoever writes a post or edits the writings loader. A post is
one MDX file in `content/writings/<slug>.mdx`; the filename is the URL slug, so
keep it lowercase with hyphens. Files whose name starts with `_` are templates
and never publish. When you finish a post, load it on the dev server and check
`/writings` and `/search?q=<a word from it>`.

## Frontmatter

Copy `_template.mdx` for an article or `_template-note.mdx` for a note. Both
templates carry a comment on every field. The loader in `lib/writings/index.ts`
reads these fields:

| Field                               | Required | Meaning                                                                                      |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `title`                             | articles | Headline. Notes and interaction posts may omit it; the first sentence of the body stands in. |
| `description`                       | no       | One-line summary for the index, metadata, and feeds. Defaults to the derived title.          |
| `published`                         | yes      | ISO date with offset, for example `2026-09-18T08:00-0700`.                                   |
| `lastUpdated`                       | yes      | Same format; renders as `dt-updated` when it differs from `published`.                       |
| `tags`                              | no       | List of lowercase tags. Tag `note` marks short posts in the index filter.                    |
| `draft`                             | no       | `true` hides the post in production and from the search index. Defaults to `false`.          |
| `postType`                          | no       | `article` (default), `note`, `photo`, `like`, `repost`, `bookmark`, or `rsvp`.               |
| `syndication`                       | no       | List of `{ name, url }` copies on other services. Each renders as a `u-syndication` link.    |
| `inReplyTo`                         | no       | URL this post answers. Makes any post kind a reply and renders `u-in-reply-to`.              |
| `likeOf`, `repostOf`, `bookmarkOf`  | no       | Target URL for an interaction post. Setting one implies the matching `postType`.             |
| `rsvp`                              | no       | `{ eventUrl, status }` with status `yes`, `no`, `maybe`, or `interested`.                    |
| `series`                            | no       | `{ slug, part }` pointing at `content/series/` or an initiative.                             |
| `featuredImage`, `featuredImageAlt` | no       | Social card image and its alt text.                                                          |

## How notes render

A note has no headline. `WritingItem` shows the derived first sentence as the
entry text instead of a title-and-summary pair, and `WritingHeader` keeps the
derived title in a screen-reader-only heading so the page still has an `h1`.
The reading-time badge is skipped for notes.

## Prose features

- `@handle` becomes a link. `@thewilliediaries` and `@williecubed` point at
  Instagram; any other handle links to `https://instagram.com/<handle>`.
- A Spotify track, album, or playlist URL on its own line becomes an embed.
- Sidenotes and fenced code with Shiki highlighting work as before; see the
  plugins in `lib/writings/`.

## Publishing from a client

A Micropub client signed in through IndieAuth can create notes and articles
through `POST /micropub`. The route writes the same frontmatter this page
describes. Details are in [the IndieWeb page](../indieweb/README.md#micropub).
