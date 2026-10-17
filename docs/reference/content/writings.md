# Writings

Writings are dated posts: articles, short notes, media, and responses to other
posts. A locally authored writing is an MDX file, combining Markdown prose with
supported page components, in `content/writings/<slug>.mdx`. Its filename
supplies the URL slug; use lowercase letters and hyphens. Files starting with
`_` are templates and do not publish.

Preview a new post on the development server and check `/writings`. Published
posts should also appear at `/search?q=<a word from it>`; drafts stay out of the
search index. The [first-writing
tutorial](../../tutorials/content/first-writing.md) provides a complete local
exercise. A client uses the same public writing model, but private drafts live
in Studio revisions until publication exports a selected revision. The client
storage boundary is described below.

## Frontmatter

Frontmatter is the field block at the top of a writing file. Copy
`_template.mdx` for an article or `_template-note.mdx` for a note; both explain
their fields in comments. `lib/writings/index.ts` reads the fields below.

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
| `likeOf`, `repostOf`, `bookmarkOf`  | no       | Target URL for an interaction post. Infers the matching kind when `postType` is absent.                   |
| `rsvp`                              | no       | `{ eventUrl, status }` with status `yes`, `no`, `maybe`, or `interested`.                                 |
| `series`                            | no       | `{ slug, part }` pointing at `content/series/` or an initiative.                                          |
| `featuredImage`, `featuredImageAlt` | no       | Social card image and its alt text.                                                                       |

### Client source and publication extensions

Micropub clients send posts as Microformats2 (MF2) properties: named values for
content, media, dates, and relationships. The loader retains those original
properties alongside the fields used to render the page. This lets a client read
and edit what it submitted even when the page does not display every property.

The following optional fields serve that source contract or publication
extensions. An ordinary authored article can omit them.

| Field            | Meaning                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `featured`       | Surfaces the post in featured-writing lists; defaults to `false`.                                                         |
| `contentFormat`  | `text` or `html` for client-generated source instead of authored MDX.                                                     |
| `micropub`       | Retained MF2 `type` and `properties` for client source reads and updates.                                                 |
| `audio`, `video` | Lists of media URLs for their native players and feed attachments.                                                        |
| `event`          | Event `start`, `end`, and `location` data.                                                                                |
| `location`       | Retained location data; its shape can include structured client properties.                                               |
| `atproto`        | Validated Standard.site extension metadata, including owned copy references. See [AT Protocol](../publishing/atproto.md). |

Client HTML is sanitized before rendering; it does not execute as MDX. When
editing a client-created file, preserve the retained MF2 map as well as the
visible page fields. Removing an undisplayed property would still change what
the client receives on its next source query.

### Timestamps and publication state

Use an offset-bearing timestamp for `published` and `lastUpdated`. Unlike an
initiative's calendar-day dates, a writing has a publication instant that feed
readers can order. Leave `lastUpdated` absent or equal to `published` until an
actual edit; a different value causes the updated microformat to render.

`draft` defaults to `false`, so omitting it is a publication decision, not a
safe way to postpone one. Templates provide a starting point, but review the
flag explicitly before deployment. Draft previews and search have different
eligibility rules: seeing a draft detail page locally does not make it a search
result.

### A post's kind and its relationships

`postType` chooses the kind of entry. `inReplyTo` adds a relationship to any
kind, so an article or photo can also be a reply. When `postType` is absent, an
interaction target such as `likeOf` supplies its matching kind. Keep the target
with the action it describes; `syndication` instead names an actual copy of this
post elsewhere.

`syndicateTo` records a requested destination, not a completed copy. This
separation lets a Micropub client preserve intent without producing a public
link to something that has not been posted.

## Person tags

Use `people` to name someone a post is about, someone pictured in it, or someone
who was there. Each entry needs their name and the absolute HTTP/HTTPS URL of
their own site or main profile. For a post describing a shared outing, the
frontmatter entry has this shape:

```yaml
people:
  - name: Jane Doe
    url: https://janedoe.example
```

### Rendering and notification

The page shows each person as a chip after “With.” Its `<a class="u-category
h-card" href="url">name</a>` markup identifies both the category relationship
and the person to IndieWeb readers. The publishing sender and `pnpm
webmentions:send` send a Webmention to the person's URL, allowing a site that accepts these
notifications to show that it was tagged.

Adding a person to a previously sent post causes the next publishing send to
revisit its targets even if the body did not change. Choose the identity URL
with that effect in mind; the tag can notify its subject as well as credit them.

Entries missing a name, using a relative or non-HTTP URL, or repeating an
earlier URL are skipped, with a warning in development. Resolve the warning by
checking the person's name and identity URL. A skipped entry loses both its
displayed attribution and its intended notification.

## Tags

Each tag on a published post has a page at `/writings/tags/<tag>` that lists the
posts carrying it, newest first, in the same layout as `/writings`. Tags match
without regard to case and the page uses the lowercase spelling, so keep them
lowercase in frontmatter. The chips under a post and under the index link to
these pages. A tag carried only by drafts has no page in production, and an old
`/writings?tag=<tag>` link redirects to the page with a 308 from
`next.config.ts`. The address helpers live in `lib/writings/tags.ts`.

Each topic page also has feeds. Before adding a near-synonym, inspect the
existing published tags: two labels for the same subject split its posts and
subscriptions across separate addresses. Case differences alone do not create a
new topic, but different words do.

## How notes render

A note has no headline. `WritingItem` shows the derived first sentence as the
entry text instead of a title-and-summary pair, and `WritingHeader` keeps the
derived title in a screen-reader-only heading so the page still has an `h1`. The
reading-time badge is skipped for notes.

A note should read as the post itself, without requiring a second piece of
headline copy. Its opening sentence still names the entry in navigation and
document structure. Check that sentence in both the index and detail preview,
where it needs to identify the post as well as begin it.

## Prose features

The writing renderer recognizes some source text as more than literal prose:

- `@handle` becomes an Instagram link. `@thewilliediaries` and `@williecubed`
  have their configured destinations; other handles use
  `https://instagram.com/<handle>`.
- A Spotify track, album, or playlist URL on its own line becomes an embed.
  Use an ordinary Markdown link when you want the destination to stay a link.
- Sidenotes and fenced code blocks are supported, with Shiki syntax highlighting
  for code. Their plugins live in `lib/writings/`.

Preview the source form you choose. A standalone music URL asks the renderer to
place a player in the reading flow, which may be appropriate when discussing a
song and distracting when mentioning it in passing. Feeds use their own
[portable HTML rules](./feeds.md#full-content) because readers cannot run those
page interactions.

## References

Footnotes and referenced passages share one numbering sequence in order of
appearance. Both produce a popover on the mark and an entry at the end of the
page, so readers can inspect a source locally or return to the collected list.

### Choose the reference form

Use a GitHub-style footnote for an aside or a source you describe in your own
words: `[^id]` in the text, followed by `[^id]: The note.` below. The definition
can appear later in the source without determining its displayed number.

Use `Ref` when a specific passage rests on a source. In the example below, the
words “this claim” remain part of the prose while the paper receives a numbered
reference mark:

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

When there are more than four entries, the list condenses to its first three and
offers a button for the rest. The list itself stays on the page. This keeps a
long list from dominating the end of an article without removing the collection
from the page.

## Publishing from a client

Micropub is the publishing API a client uses to create and edit writings.
IndieAuth authorizes that client to act for the owner. Once authorized, the
client can save and edit private Studio revisions or use the compatibility path
for existing published files. The protocol maps MF2 properties to this writing
model; private revision storage is deliberately separate from public MDX. See [IndieWeb:
Micropub](../publishing/indieweb.md#micropub) for endpoint details.

### Creating and reading a post

The client creates writings through `POST /micropub`, including notes, photo
notes, articles, and the other supported kinds. Upload photos first through
`POST /micropub/media`. `q=source` reads the saved post as mf2 properties;
`q=category` supplies published tags for suggestions. Source reads prefer a
matching private Studio document, otherwise the configured GitHub branch or local
public source. A saved draft can therefore be readable to its authorized client
without having a public permalink.

Creation with `post-status=draft` accepts `create` or `draft` scope and requires
private Studio storage. It returns 503 when that store is absent; draft source
never falls back to GitHub or a local content file. Publishing an authored draft
still requires Willie to approve its exact text and dates. Saving a revision or
receiving 202 is not publication approval.

Micropub advertises only configured destinations it can execute, currently
Bluesky when the publication and publishing credential are available. Accepting
`mp-syndicate-to` records the chosen account URL in `syndicateTo`; the
subsequent publishing workflow consumes that intent after the Standard.site
document exists. Unknown targets are rejected. Threads sharing remains manual.

Record an actual outside copy in `syndication` only when its permalink exists.
Requested delivery and confirmed copies remain separate so a reader never
receives an invented syndication link. See the [syndication
contract](../publishing/indieweb.md#micropub) for the complete path.

### Updating without replacing the author's file

For an existing public file, the compatibility updater changes the requested
frontmatter and body fields while preserving unrelated comments and formatting.
Its GitHub write carries the previously read blob SHA and rejects a concurrent
edit instead of overwriting it. It sets `lastUpdated` to request time.

Private Studio source instead saves a new revision against its previous head ID.
That is a revision-aware edit, not a promise to preserve every byte of a rendered
MDX export. A draft stays private unless the update explicitly replaces
`post-status` with `published`. The selected-revision publication path then
handles protected GitHub review/merge and deployment; an ordinary edit does not
clear the draft state or bypass approval. Saving a private draft revision also
does not retract a previously exported public revision.

### Deleting and recovering

An existing published file is archived exactly in the private Micropub deletion
archive before the compatibility backend removes it. After deployment, the
permalink answers 404. A client with `undelete` scope can restore that archived
source at its original permalink; an occupied path rejects restoration rather
than overwriting another post. Git revert is a separate repository recovery
option and does not replace the archive/scope checks.

A private Studio document uses revision-checked removal and retains its immutable
source revisions. It does not enter the public-source deletion archive, so that
archive's Micropub `undelete` operation is not a restore path for private drafts.
Removing that private document does not itself delete an already exported public
file; verify the public source separately before claiming its permalink is gone.
A legacy draft file must be imported into private storage before the endpoint
will delete it; absence of that import returns 503.

A request records a source operation. Public output changes only when the
corresponding publication/deployment completes. Verify those stages separately,
and do not assume that deleting a writing also deletes its R2 objects, outside
copies, or stored Webmentions.
