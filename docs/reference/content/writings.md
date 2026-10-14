# Writings

Each writing is an MDX file in `content/writings/<slug>.mdx`. Its filename is
the URL slug; use lowercase letters and hyphens. Files starting with `_` are
templates and do not publish.

Preview a new post on the dev server and check `/writings`. For a published
post, also check `/search?q=<a word from it>`; drafts stay out of the search
index. Use the [first-writing
tutorial](../../tutorials/content/first-writing.md) for a complete local
exercise.

## Frontmatter

Copy `_template.mdx` for an article or `_template-note.mdx` for a note. Both
templates carry a comment on every field. The loader in `lib/writings/index.ts`
reads these fields:

| Field                               | Required | Meaning                                                                                                   |
| ----------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `title`                             | articles | Headline. Notes and interaction posts may omit it; the first sentence of the body stands in.              |
| `description`                       | no       | One-line summary for the index, metadata, and feeds. Defaults to the derived title.                       |
| `published`                         | yes      | ISO date with offset, for example `2026-09-18T08:00-0700`.                                                |
| `lastUpdated`                       | no       | Defaults to `published`; same timestamp format. Renders `dt-updated` when different.                      |
| `tags`                              | no       | List of lowercase tags. Each one gets a page; see Tags below. `note` marks short posts.                   |
| `people`                            | no       | List of `{ name, url }` people tagged in the post. See Person tags below.                                 |
| `draft`                             | no       | `true` hides the post in production and from the search index. Defaults to `false`.                       |
| `postType`                          | no       | `article` (default), `note`, `photo`, `audio`, `video`, `event`, `like`, `repost`, `bookmark`, or `rsvp`. |
| `syndication`                       | no       | List of `{ name, url }` copies on other services. Each renders as a `u-syndication` link.                 |
| `syndicateTo`                       | no       | Account URLs from Micropub `mp-syndicate-to`. Requested delivery; not a public copy link.                 |
| `photo`                             | no       | List of `{ url, alt }` photos shown under the date. Each renders as a `u-photo`.                          |
| `inReplyTo`                         | no       | URL this post answers. Makes any post kind a reply and renders `u-in-reply-to`.                           |
| `likeOf`, `repostOf`, `bookmarkOf`  | no       | Target URL for an interaction post. Setting one implies the matching `postType`.                          |
| `rsvp`                              | no       | `{ eventUrl, status }` with status `yes`, `no`, `maybe`, or `interested`.                                 |
| `series`                            | no       | `{ slug, part }` pointing at `content/series/` or an initiative.                                          |
| `featuredImage`, `featuredImageAlt` | no       | Social card image and its alt text.                                                                       |

### Client source and publication extensions

The loader also reads these optional fields. They preserve information that a
client submitted or that publishing needs; an ordinary authored article can
omit them.

| Field            | Meaning                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `featured`       | Surfaces the post in featured-writing lists; defaults to `false`.                                                         |
| `contentFormat`  | `text` or `html` for client-generated source instead of authored MDX.                                                     |
| `micropub`       | Retained MF2 `type` and `properties` for client source reads and updates.                                                 |
| `audio`, `video` | Lists of media URLs for their native players and feed attachments.                                                        |
| `event`          | Event `start`, `end`, and `location` data.                                                                                |
| `location`       | Retained location data; its shape can include structured client properties.                                               |
| `atproto`        | Validated Standard.site extension metadata, including owned copy references. See [AT Protocol](../publishing/atproto.md). |

Client HTML follows the sanitizing rendering path; storing it does not authorize
executing arbitrary MDX. Retained MF2 data lets an update preserve properties a
particular page renderer does not display. Keep those representations distinct
when editing client-created files, so a visual change does not discard the
client's source contract.

### Timestamps and publication state

Use an offset-bearing timestamp for `published` and `lastUpdated`. Unlike an
initiative's calendar-day dates, a writing has a publication instant that feed
readers can order. Keep `lastUpdated` aligned with `published` until there is an
actual edit; differing values cause the updated microformat to render.

`draft` defaults to `false`, so omitting it is a publication decision, not a
safe way to postpone one. Templates provide a starting point, but review the
flag explicitly before deployment. Draft previews and search have different
eligibility rules: seeing a draft detail page locally does not make it a search
result.

### A post's kind and its relationships

`postType` chooses the kind of entry. `inReplyTo` adds a relationship to any
kind, so an article or photo can also be a reply. An interaction target such as
`likeOf` implies its matching kind. Keep the target with the action it describes;
`syndication` instead names an actual copy of this post elsewhere.

`syndicateTo` records a requested destination, not a completed copy. This
separation lets a Micropub client preserve intent without producing a public
link to something that has not been posted.

## Person tags

`people` tags a person in a post, the IndieWeb way: the post is about them, they
are in its photo, or they were there. Each entry needs a `name` and the absolute
URL of their own site or main profile.

```yaml
people:
  - name: Jane Doe
    url: https://janedoe.example
```

### Rendering and notification

Each person renders under the post as a chip after the word "With", marked up as
`<a class="u-category h-card" href="url">name</a>`. The post build's
`webmentions:send` sends each URL a webmention, as do `/api/webmention/send` and
`/api/webmention/send-all`, so a site that accepts webmentions can show that it
was tagged. An entry without a name, with a relative or non-http URL, or
repeating an earlier URL is skipped, and the dev server logs a warning. Adding a
person to a post already sent resends its webmentions on the next build even
when the body is unchanged.

A person tag can therefore notify someone; it is more than a decorative label.
Use the person's own site or main profile so the relationship points to their
identity. The skip-and-warn behavior protects rendering from malformed entries,
but it is not a reason to leave those warnings unresolved: an omitted entry
also loses its intended attribution and notification.

## Tags

Each tag on a published post has a page at `/writings/tags/<tag>` that lists the
posts carrying it, newest first, in the same layout as `/writings`. Tags match
without regard to case and the page uses the lowercase spelling, so keep them
lowercase in frontmatter. The chips under a post and under the index link to
these pages. A tag carried only by drafts has no page in production, and an old
`/writings?tag=<tag>` link redirects to the page with a 308 from
`next.config.ts`. The address helpers live in `lib/writings/tags.ts`.

Tags create both navigation and subscription destinations. Reusing a lowercase
spelling lets readers move through one topic page rather than an editorially
accidental set of variants. Before adding a near-synonym, inspect the existing
published tags; a new label creates another address and another set of feeds.

## How notes render

A note has no headline. `WritingItem` shows the derived first sentence as the
entry text instead of a title-and-summary pair, and `WritingHeader` keeps the
derived title in a screen-reader-only heading so the page still has an `h1`. The
reading-time badge is skipped for notes.

The derived title serves navigation and document structure while the visible
entry reads like the short post itself. This avoids forcing every note into an
article's headline-and-summary form. Check the opening sentence in both the
index and detail preview: it needs to work as the entry text and as the name a
reader encounters outside the body.

## Prose features

- `@handle` becomes a link. `@thewilliediaries` and `@williecubed` point at
  Instagram; any other handle links to `https://instagram.com/<handle>`.
- A Spotify track, album, or playlist URL on its own line becomes an embed.
- Sidenotes and fenced code with Shiki highlighting work as before; see the
  plugins in `lib/writings/`.

These transformations happen from the source text. A standalone Spotify URL
means “embed this,” while the same destination in an ordinary link can remain a
link. Choose the source form for the intended reading experience, then inspect
the rendered result; a literal-looking handle or URL may carry behavior beyond
its typography. Feed rendering has its own portable HTML rules in
[Feeds](./feeds.md#full-content).

## References

Footnotes and referenced passages share one numbering sequence in order of
appearance. Both produce a popover on the mark and an entry at the end of the
page, so readers can inspect a source locally or return to the collected list.

### Choose the reference form

Use a GitHub-style footnote for an aside or a source you describe in your own
words: `[^id]` in the text, followed by `[^id]: The note.` below. The definition
can appear later in the source without determining its displayed number.

Use `Ref` when a specific passage rests on a source:

```mdx
<Ref href="https://example.org/paper" title="The paper">
  this claim
</Ref>
```

The passage keeps its text and gains a mark; the list displays the title and
host. `title` is optional and falls back to the passage. A useful explicit title
helps someone identify the source without rereading the entire quoted claim.

### Numbering and the collected list

`lib/writings/references.ts` numbers both forms. The remark plugin in
`lib/writings/remark-sidenotes.ts` and the page use that same function, keeping
a mark paired with its list entry when either form is added or moved.

When there are more than four entries, the list condenses to its first three
and offers a button for the rest. The list itself stays on the page. The
threshold reduces the space a long source list occupies while keeping the
reference collection discoverable.

## Publishing from a client

A Micropub client authenticated through IndieAuth edits the same writing files
as a local author. The protocol maps client properties to this page's
frontmatter contract rather than maintaining a separate store of posts. See
[IndieWeb: Micropub](../publishing/indieweb.md#micropub) for endpoint details.

### Creating and reading a post

The client can create notes, photo notes, and articles through `POST /micropub`.
Upload photos first through `POST /micropub/media`. `q=source` reads the saved
post as mf2 properties; `q=category` supplies published tags for suggestions.

Micropub advertises only configured destinations it can execute, currently
Bluesky when the publication and publishing credential are available. Accepting
`mp-syndicate-to` records the chosen account URL in `syndicateTo`; the subsequent
publishing workflow consumes that intent after the Standard.site document exists.
Unknown targets are rejected. Threads sharing remains manual.

Record an actual outside copy in `syndication` only when its permalink exists.
Requested delivery and confirmed copies remain separate so a reader never
receives an invented syndication link. See the
[syndication contract](../publishing/indieweb.md#micropub) for the complete path.

### Updating without replacing the author's file

An update rewrites only changed frontmatter keys and preserves the remainder,
including hand-edited comments and formatting. It sets `lastUpdated` to the
request time. A client publishes a draft only when it replaces `post-status`
with `published`; ordinary edits do not implicitly clear the draft state.

### Deleting and recovering

A delete removes the source file. After deployment, its permalink answers 404.
Before deletion, the endpoint archives the exact source privately. A client with
`undelete` scope can use `action=undelete` to restore that source at its original
permalink. Restoration rejects an occupied path rather than overwriting a newer
post. A Git revert is a separate repository recovery option, not a substitute for
the protocol archive lifecycle.

The request records a source change; the public route changes after deployment.
Verify both stages when testing deletion or restoration.
