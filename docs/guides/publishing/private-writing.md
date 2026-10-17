# Maintain the private writing preview

The preview lets Willie save and review private working copies on the website,
then publish one selected revision through the repository's protected workflow.
Saving a draft and releasing it are separate operations: production continues to
read published files rather than the editor's working revisions.

Run the commands below from the repository root. Provider setup requires access
to the existing owner Access application, private database, R2 buckets, preview
Worker, and website repository. Use the local validation section for source and
browser checks; hosted acceptance has additional requirements.

## Authoring boundary

Willie authors all writing, titles, descriptions, and editorial text. Lattice
connects the editor to an owned personal runtime for widget generation. Its
integration is exclusively for widgets and inline interactive components. It
receives only the explicit widget specification, never the surrounding draft or
a selected passage. The API rejects prose generation, rewriting, and acceptance
of legacy prose proposals. Widget implementations require isolated preview and
explicit approval before insertion. Static equivalents keep them accessible and
portable.

### Preview identity and public rendering

`preview.willie.page` uses the `willie-page-preview` Cloudflare Worker with
`SITE_MODE=preview`. The owner signs in through the same Cloudflare Access
application as the live admin. Signed Access identity is checked again inside
the Worker, including on its direct `workers.dev` address. The full Next.js
Worker needs Workers Paid: its hosted build exceeded Free's 10 ms CPU limit.

Production continues to render published repository MDX. It does not load
private revisions. Preview overlays private working revisions at request time,
so saving needs no deployment. Draft and Unpublished changes labels are text,
not color alone. Existing initiative drafts are readable; their editors wait
until the writing workflow is proven.

## Writing experience and site fidelity

### Preserve the reading page

The preview is the website with private working copies. Reuse `TopBar`,
`WritingHeader`, `WritingItem`, the reading/content column widths, and the
existing typography, color, focus, popover and motion tokens. Private controls
must not introduce a parallel dashboard, framed paper surface, or new visual
system. The writing index follows the public index's card and spacing patterns.

### Keep writing as the default activity

Writing is the default activity. Details, revision history, the widget
generator, and publication review appear only when requested. Selection
formatting and insertion preserve the writing cursor; returning from a task
restores focus. Notes begin with their date and prose; articles use the public
title, description and byline composition. Status remains readable as text,
including unpublished changes before autosave completes. Website review uses the
native reading styles; portable HTML and plain text are reviewed separately.

### Review the experience

Check actual desktop and phone renderings, light and dark themes, long titles,
notes, catalog blocks, keyboard focus and recovery states after changing these
surfaces. Automated accessibility checks support this review but do not replace
screen-reader and hosted acceptance.

## Provider setup

### Private storage and migrations

Use the dedicated private Neon Postgres database through `STUDIO_HYPERDRIVE`,
the private `willie-page-studio-private` R2 bucket for working assets, and the
existing `willie-page-media` R2 bucket for promoted media. The private bucket
has no public domain. Never use the public search/IndieWeb database for private
writing. Apply migrations directly to the private database:

```sh
STUDIO_DATABASE_URL=... pnpm studio:migrate
```

Here `...` means the connection string for the dedicated private database, not
the public search database. Supply it through the private environment setup; do
not commit a real value.

### Server-only configuration

Secrets belong in provider environment settings or an ignored local env file.
The preview project requires these server-only variables:

| Variable                      | Meaning                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| `SITE_MODE`                   | `preview` on preview; `production` on production                         |
| `STUDIO_ORIGIN`               | `https://preview.willie.page`                                            |
| `OWNER_ACCESS_ISSUER`         | Existing Owner access issuer                                             |
| `OWNER_ACCESS_AUDIENCE`       | Existing Owner access application audience                               |
| `OWNER_ACCESS_EMAIL`          | Willie's identity from the existing allow policy                         |
| `STUDIO_HYPERDRIVE`           | Dedicated private Neon Postgres binding                                  |
| `STUDIO_PRIVATE_BUCKET`       | Private R2 bucket for working images                                     |
| `STUDIO_PUBLIC_MEDIA_BUCKET`  | Preview-only binding to production R2 media for approved promotion       |
| `STUDIO_TOKEN_ENCRYPTION_KEY` | 32 random bytes encoded as base64, retained across deployments           |
| `STUDIO_LATTICE_ISSUER`       | Lovelace OAuth issuer                                                    |
| `STUDIO_LATTICE_CLIENT_ID`    | `https://willie.page/.well-known/lattice-client.json`                    |
| `STUDIO_LATTICE_GATEWAY`      | Supported Lattice gateway/resource URL                                   |
| `STUDIO_LATTICE_RUNTIME_ID`   | Optional initial device ID; normally choose a named device in the editor |
| `STUDIO_GITHUB_REPOSITORY`    | `owner/repository` for the website                                       |
| `STUDIO_GITHUB_BRANCH`        | `main`                                                                   |
| `STUDIO_GITHUB_TOKEN`         | Website-only Contents and Pull requests read/write                       |
| `STUDIO_PUBLIC_ORIGIN`        | `https://willie.page`                                                    |

### Connect Lattice to a personal runtime

The public client metadata declares the sole OAuth redirect
`https://preview.willie.page/api/studio/lattice/callback`. Deploy the metadata
on the public website before connecting. The issuer is
`https://auth.uselovelace.com` and gateway is `https://lattice.uselovelace.com`.
Choose an owned personal device by name in the editor. Credentials are stored
encrypted in private Postgres. The author connects Lattice from the editor. An
unavailable personal runtime retains the request and offers retry.

### Deploy behind the owner Access policy

Deploy the preview Worker with the preview bindings in `cloudflare.config.ts`.
Attach `preview.willie.page` only after the direct
Worker has passed signed Access, private database, and media checks. The
existing Owner access application covers the entire preview hostname. The Worker
independently validates RS256 signatures, issuer, audience, expiry, and owner; a
direct `workers.dev` URL cannot bypass Access. Production `/studio` and
`/api/studio` paths return 404.

### Private drafts from Micropub clients

For authenticated Micropub clients, also provide the private database and
publication/media variables on production. Existing IndieAuth scope checks still
run first. Creating, editing, and deleting private drafts use durable Studio
revisions. `post-status=draft` writes privately; explicit publication exports a
selected immutable revision. If private storage is unavailable, a draft request
fails closed rather than falling back to a GitHub or local draft file. Deleting
a private working document retains its history and any already published
public file.

Production shares the private database and bucket with preview for authenticated
Micropub drafts. It uses its existing `MEDIA_BUCKET` binding when a private
revision promotes an image. `SITE_MODE=production` keeps private revisions out
of public pages and the Studio UI. Ordinary public Micropub posts continue to
use the existing GitHub Contents publication path.

## Import existing drafts

Import against the hosted private database first, while retaining the source
files:

```sh
pnpm studio:import
```

The command imports existing non-hidden writing files with `draft: true` and
reads each immutable revision back. Repeated imports preserve subsequent private
edits, so a retry does not reset the author's work to the repository copy.

Complete hosted save/reopen acceptance before removing source drafts. Then run:

```sh
pnpm studio:import --remove-verified-files
```

Removal verifies the original Git blob SHA, full structured body, and unchanged
local file before deleting it. Commit the verified removals to `main` only after
hosted save/reopen acceptance. Existing public Git history remains public;
deleting a current file does not make its earlier contents private. No draft
files were removed during the original local setup.

## Publication and portable content

### Review and publish one saved revision

Save, inspect website and portable previews, and publish the reviewed saved
revision. New edits invalidate the review. Publication validates titles, image
descriptions, portable blocks and safe MDX; promotes only referenced assets;
bundles only approved component versions; then creates a durable publication
branch and pull request.

Required checks and existing branch rules remain authoritative; publication uses
rebase merging without bypass. Unrelated main updates rebase the exact artifact
hashes through compare-and-swap on the private branch: the update succeeds only
if that branch still has the expected state. Conflicting artifact edits stop
publication. Retrying recovers the same proposal and pull request.

Publishing moves to Deploying, then Live only when the public revision marker,
MDX blob hash, and deployed Git ancestry prove the selected revision is served.
Later edits preserve the live revision.

### Preserve source and portable alternatives

Imported MDX stays byte-preserved in source blocks. Unfamiliar imports,
expressions, components, and executable attributes require reviewed catalog
conversion before publication. Generation never silently overwrites newer saves.
Components require an explicit review, a typed property schema, accessibility
requirements, and portable HTML/text. Their browser execution uses opaque
sandboxed frames with no app credentials or network access. Published frames
have a response sandbox policy as well as an iframe sandbox. A meaningful static
alternative remains readable beside the interactive block.

### Keep private content out of discovery

Preview disables analytics and protocol discovery, rejects feeds, sitemap, MCP,
oEmbed and notifications, and authenticates assets and search. Public feeds,
Pagefind, discovery, webmentions and syndication explicitly select published
files. Private search never imports Pagefind.

## Writing-session interactions

### Entry, cursor, and save state

New writing opens a private blank draft directly into prose. The entry focus
intent is consumed once, so reopening a saved draft does not summon a phone
keyboard. Title and description remain optional while drafting; Add a title
reveals the native article heading fields when wanted. Existing articles keep
their reading-page presentation.

The blank writing area continues the reading column and places the cursor at the
end when tapped. The keyboard insert shortcut opens the existing site popover
beside the cursor; Escape returns to the passage. Details, history, proposals
and review restore writing focus and selection, while switching preview tabs
preserves tab focus. Routine autosave remains visible, with settled save/error
announcements rather than keystroke announcements. Task entry uses the existing
site easing and respects reduced motion. Untitled articles use their opening
sentence in the library; notes keep prose-first identities. Returning to a
cached editor recreates Tiptap from the current working document, and New
writing becomes available again on return.

### Return from Lattice without losing the task

Lattice connection returns to the same writing task. The widget specification
remains in tab-local recovery storage. Generation receives no selected passage
or surrounding prose. It uses readable progress labels and offers retry for
waiting or failed requests.

## Validation and remaining hosted acceptance

### Local checks

```sh
STUDIO_TEST_DATABASE_URL='postgresql:///postgres?host=/tmp' pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:studio
```

The browser harness starts a genuine signed-JWT boundary with ephemeral JWKS (a
temporary signing-key set), an isolated local Postgres schema, and the actual
Next preview. It does not introduce an authentication bypass. It requires local
Postgres at `/tmp`.

### Hosted acceptance

Before declaring the preview live, complete these checks on its hosted
providers:

1. Authenticate through the real personal Access policy. Confirm anonymous and
   direct-origin requests are denied, including assets and search.
2. Save and reopen a private writing. Generate on the selected personal runtime,
   then review and insert a component.
3. Inspect portable output in a feed reader. Upload an image and promote it
   through the publication workflow.
4. Publish the selected revision. Verify the public marker, permalink, and
   deployment failure/retry behavior.
5. Review real desktop and phone layouts, keyboard operation, and a screen reader.

Local browser and axe checks do not establish human screen-reader or
hosted-provider acceptance.

## Remaining hosted work

Deploy private writing changes to the preview Worker deliberately with the
Cloudflare preview commands; the preview has no Git build connection, so it
does not duplicate every production build. Lattice is connected on the hosted
preview, but fresh generation has returned invalid widget output or timed out.
Generation, proposal approval, and protected publication remain unverified on
this Worker. Retry the retained publication and verify the exact deployed
source hash before claiming Live.

The component-only implementation is the required deployment; prose generation
and generation-driven document replacement are excluded from this product. The
[October 10–13 record](https://github.com/WillieCubed/website/blob/566f37b570df167f917f20217ee6fcd5131d12a8/docs/guides/publishing/private-writing.md#hosted-observations-and-remaining-work)
describes the earlier provisioning, design review, and Worker migration.
