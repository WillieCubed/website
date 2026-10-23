# Micropub and media

<a id="micropub"></a>

Maintainers and client authors use this reference to inspect source queries, writing mutations, and media upload behavior. `/micropub` publishes through [IndieAuth](indieauth.md) credentials. The [configuration reference](indieweb-configuration.md) owns environment settings and migration order.

## Authentication and request formats

`POST /micropub` accepts form-encoded, multipart, or JSON `h-entry` and
`h-event` bodies with a bearer token. The token must be one this site's own
token endpoint issued: it is looked up in the `indieauth_tokens` table (see
[IndieAuth](indieauth.md)), with no call to another server, and must be unexpired,
unrevoked, carry the scope the request needs, and have a `me` on the canonical
origin. A client may send one token in the bearer header or form body. Missing
and invalid tokens get 401; a valid token without the scope gets 403
`insufficient_scope`. Two tokens get 400.

| Request                                    | Scope               | Answer                                                                |
| ------------------------------------------ | ------------------- | --------------------------------------------------------------------- |
| `POST` a published `h-entry`               | `create`            | 202 with `Location`; public output follows publication/deployment     |
| `POST` with `post-status=draft`            | `create` or `draft` | 202 with a saved private revision; no public file fallback            |
| `POST` `action=update`                     | `update`            | 200 with `{ url, path, commit }`                                      |
| `POST` `action=delete`                     | `delete`            | 200 with `{ url, path, commit }`; see backend-specific deletion below |
| `POST` `action=undelete`                   | `undelete`          | Restores the archived original source and permalink                   |
| `GET ?q=source&url=` (and `properties[]=`) | any                 | the writing's mf2 JSON, drafts included                               |
| `GET ?q=config`, `?q=syndicate-to`         | none                | capabilities, syndication targets, and the `q` values it answers      |
| `GET ?q=category` (and `filter=`)          | none                | `{ categories }`, the tags of published writings                      |

## Creation, citations, and stable slugs

In a JSON body, `in-reply-to`, `like-of`, `repost-of`, and `bookmark-of` may
each be a URL or an embedded `h-cite`. The post preserves the embedded h-cite
and every supplied value. Rendering uses its `url`, or its `value` when it has
no `url`, and a citation that names neither gets a 400 `invalid_request`.

An `mp-slug` becomes the file name and the permalink, so it may use only
letters, digits, hyphens, and underscores, and must start with a letter or
digit. Anything else, such as `../` or a leading `_`, gets a 400
`invalid_request` rather than a rewritten slug, so the client never publishes at
an address it did not ask for. `feed`, `opengraph-image`, and `tags` are refused
the same way, since a route already answers at each of them. Without `mp-slug`
the site makes a slug from the name or text, and a made slug that lands on one
of those names gets a timestamp suffix.

For example, an explicit `mp-slug=tea-break` requests `/writings/tea-break`.
An explicit `mp-slug=tags` is rejected because `/writings/tags` already belongs
to routing. Quietly changing the second request to a different slug would make
the client lose control of the address it asked to publish.

## Choose the source store

A draft and a published file have different storage boundaries. Creation with
`post-status=draft` always saves a durable private Studio revision. It requires
private storage; absence returns 503 rather than committing draft text to GitHub
or writing it into `content/writings`. The 202 response includes the saved
revision and intended permalink, not a promise that the permalink is public.

Source reads prefer a private Studio document with the matching slug. Updating
that document saves another revision with a compare-and-swap against its previous
head. Publishing a selected revision uses the Studio publication path, including
its protected GitHub review/merge and deployment checks. Willie must approve an
authored writing's exact text and dates before that public operation.

Existing published files retain the compatibility backend. With
`STUDIO_GITHUB_REPOSITORY` and `STUDIO_GITHUB_TOKEN`, the endpoint uses GitHub's
Contents API on `STUDIO_GITHUB_BRANCH` (default `main`); without them it writes
to a writable local checkout. Those fallbacks serve public files, never private
drafts. A read-only hosted checkout needs the configured publication backend.
An accepted source change must still be followed through to the deployed public
permalink before claiming publication.

## Source queries

A source query lets an editor retrieve the data it would change, including a
draft. `?q=source&url=<permalink>` returns
`{ "type": ["h-entry"], "properties": { ... } }` from private Studio source when a matching document exists, otherwise from the
configured GitHub branch or local public file. It can therefore describe a saved
revision or commit that the public deployment does not yet serve.

The mapping preserves the writing's authoring form. `title` becomes `name`,
`description` becomes `summary`, and the original body becomes `content` as
literal text or an HTML object according to its source format. `draft` becomes
`post-status`; `published` and `lastUpdated` return as `published` and `updated`
in UTC. Tags return as `category` strings, while person tags return as category
`h-card`s.

Relationship fields return as their corresponding MF2 properties:
`inReplyTo`, `likeOf`, `repostOf`, `bookmarkOf`, and `rsvp` become
`in-reply-to`, `like-of`, `repost-of`, `bookmark-of`, and `rsvp`. `photo` and
`syndication` keep their names, and `url` is the permalink. Keys without an MF2
property, such as `series` and `featured`, are omitted from the response, not
deleted from the source file.

`properties[]=content` (or `properties=content`) filters the response to the
requested properties and omits `type`. A URL outside this origin's writing
permalinks, or one without saved source, returns 400 `invalid_request`. The
response uses `Cache-Control: no-store` because it includes authenticated source
state rather than only deployed public content.

## Category queries

`?q=category` answers `{ "categories": [...] }` with the tags of published
writings, lowercase and sorted, the same tags that have pages under
`/writings/tags` in production. `filter=tr` keeps the tags that start with `tr`,
ignoring case.

This query needs no token, so it leaves out tags that only drafts carry,
even on a development server that shows drafts.

## Updates

An update names the writing's permalink in `url` and changes properties through
`replace`, `add`, and `delete`. JSON follows the Micropub property grammar;
forms use names such as `replace[name][]=…`, `add[category][]=…`,
`delete[category][]=…`, and `delete[]=photo`. A deletion can name whole
properties or individual values.

Nested and multivalued MF2 properties—including media, locations, citations, and
syndication intent—remain in the source model. Recognized fields feed page
rendering. Additional properties are retained as data rather than executed code;
literal text stays literal, and HTML follows the safe markup policy.

### Preserve edits and reject races

For an existing public source file, the compatibility updater rewrites changed
frontmatter and body fields while preserving unrelated bytes such as comments
and formatting. Its GitHub write carries the previously read blob SHA, so a
concurrent edit returns 409 instead of being overwritten. A no-op creates no
commit. The update sets `lastUpdated` to request time rather than accepting a
client-supplied `updated` value.

Private source uses saved Studio revisions instead of a byte-preserving file
edit. A matching document is updated against its previous revision ID; an
intervening save rejects the stale edit. A draft remains private unless an update
explicitly replaces `post-status` with `published`. That transition invokes the
publication path, not a local file fallback. Ordinary edits must not clear the
draft state or bypass publication approval. Saving a draft revision of a previously
published writing does not retract its already exported public revision.

## Deletes

Deletion follows the source backend. An existing public file is archived exactly
in `micropub_deleted_writings` before it is removed through GitHub or the local
checkout. GitHub deletion uses the read blob SHA and rejects a conflicting edit
with 409. Once deployed, the removed file leaves public lists, feeds, sitemap,
and search. Referenced R2 objects, older external media, and stored Webmentions
are not removed by deleting the writing.

### Archive before removal

The public archive commits before the external file mutation so a failed delete
can leave a recoverable source. `action=undelete` requires `undelete` scope and
restores that archived source at its original permalink, rejecting collisions.
Transaction advisory locks serialize the public lifecycle operations. Deleted
public posts notify previous Webmention targets after deployment.

A private Studio document instead uses the store's revision-checked removal.
Its immutable source revisions do not enter the public Micropub deletion archive,
and that archive's `undelete` path is not a private-document restore operation.
Removing the private document does not itself remove an already exported public
file; inspect that public source separately before claiming the permalink is gone.
A legacy draft file must be imported into private storage before deletion; the
handler returns 503 rather than archiving that draft in the public store.

## Syndication

`?q=syndicate-to` and `?q=config` advertise only the configured Bluesky account
when publishing credentials are available. Creation and updates retain explicit
per-writing `mp-syndicate-to` intent. Standard publishing executes it after the
document exists. [AT Protocol publishing](atproto.md) describes duplicate
prevention and copy associations. Manual Bluesky and Threads sharing remains
available on writing pages.

## Media

A configured `MEDIA_BUCKET` R2 binding makes `/micropub/media` appear as the
`media-endpoint` in `q=config`. The client uploads one multipart `file` first,
using a token with `media` or `create` scope. The endpoint checks supported type,
byte signature, and the 4 MiB limit; SVG is rejected.

The object lives in a private R2 bucket under
`media/<year>/<month>/<name>-<random>.<ext>`, but the returned URL is public site
media served through `/media/*`. The endpoint returns 201 with that URL in
`Location` and JSON `url`; without the binding it returns 503. Private bucket
access is distinct from public delivery: saving a writing as a private draft
does not make a separately uploaded Micropub media URL private.

### Photo descriptions and placement

Each JSON `photo` must be `{ "value": url, "alt": text }` with nonblank alt text.
Bare JSON URLs and form `photo`/`photo[]` values return 400 `invalid_request`.
The source stores `{ url, alt }`, and a photo post can have an empty caption.
Inline authored photos keep their position and `u-photo`; the header renders
only photos absent from the body so it does not repeat them.

Only HTTP/HTTPS photo URLs are accepted. Direct multipart photo creation at
`/micropub` returns 400 before uploading; send files to `/micropub/media` first.
Build and pre-push checks enforce nonblank authored alt text too.

### Validation and playback limits

`MEDIA_TYPES` in `lib/indieweb/media.ts` defines accepted image, audio, video,
and PDF types. Empty files, SVG, mismatched signatures, and files above 4 MiB
are rejected. Audio/video use native controls without autoplay; PDFs remain
links. Container recognition does not establish that a browser decodes every
codec inside it.

### Storage and existing URLs

The route uses the `MediaStore` interface; `getMediaStore()` selects the Worker
R2 binding. New uploads receive site URLs. Older external URLs remain as authored
unless a separate media migration changes those references.

## Public delivery

`GET /media/*` streams validated immutable R2 object keys. The route advertises
`Accept-Ranges: bytes`, `ETag`, `Last-Modified`, `Content-Length`, and
`Cache-Control: public, max-age=31536000, immutable`. `HEAD` returns metadata
without reading an object body. A matching `If-None-Match` returns 304.

A single satisfiable `Range: bytes=...` request returns 206 and its exact
`Content-Range`. A valid but unsatisfiable range returns 416 with
`Content-Range: bytes */<size>`. Unsupported or malformed range syntax, including
multiple ranges, falls back to a complete response. A failed `If-Range` validator causes a complete
200 response. Delivery checks the object's ETag again when opening its stream;
a replacement after the metadata read returns 412 rather than stale lengths.
Missing keys return 404, and an absent bucket returns 503.

Private Studio media uses separate authenticated storage and delivery. Uploading
through the public Micropub media endpoint does not inherit a draft's privacy.
