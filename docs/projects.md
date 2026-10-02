# Projects

This guide is for whoever adds or edits a project page, whether that is Willie or an agent working for him. After reading it you can create `content/projects/<slug>.mdx` and know which fields you may fill.

## Every sentence is Willie's own words

Every title, line, body paragraph, caption, and alt text on a project page is something Willie wrote. An agent copies his text exactly, typos included, or leaves the field empty. An agent never writes, shortens, or rewords any of it. The page leaves out whatever is empty, so an empty field costs nothing.

The page adds only the status names (`STATUS_LABELS` in `lib/projects/facts.ts`) and the host label on a link that has no `label`.

## Where a project lives

Each project is one file, `content/projects/<slug>.mdx`, and the slug is the URL: `content/projects/orbit.mdx` serves `/projects/orbit`. Files that start with an underscore are skipped. Copy `content/projects/_template.mdx` to begin.

The body below the frontmatter is MDX, and Willie writes it.

## Frontmatter

The schema is `lib/projects/schema.ts`. It rejects unknown keys, so a misspelled field fails the build and does not vanish.

| Field           | Type                               | Meaning                                                                   |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| `title`         | string, required                   | The project name.                                                         |
| `line`          | string                             | One line about the project. Also the page description.                    |
| `owners`        | list of owner keys                 | Organizations the project belongs to. Empty means Willie's own.           |
| `parent`        | slug                               | The project this one is part of.                                          |
| `initiative`    | slug                               | The initiative under `/initiatives` this project serves.                  |
| `successor`     | slug or `https://` URL             | Where the project went next.                                              |
| `roles`         | list of strings                    | What Willie did on it.                                                    |
| `collaborators` | list of `{ name, href? }`          | People he worked with. `href` is `https://`.                              |
| `starts`        | date                               | When it began.                                                            |
| `ends`          | date                               | When it ended.                                                            |
| `updated`       | date                               | When Willie last touched it.                                              |
| `status`        | see below                          | Left out, it is worked out from the dates.                                |
| `weight`        | integer, 0 to 100                  | Pins a project earlier in the sort. Default 0.                            |
| `visibility`    | `public`, `facts`, `hidden`        | See below. Default `public`.                                              |
| `brand`         | `#rrggbb` or a key in `seeds.json` | The color seed for the page.                                              |
| `website`       | `https://` URL                     | The project's own site. It leads the link chips and feeds the brand seed. |
| `media`         | list                               | Images, YouTube videos, and documents. See below.                         |
| `links`         | list of `{ href, label? }`         | Willie's links. A link without a `label` shows its host and path.         |
| `draft`         | boolean                            | Default false. See Drafts.                                                |

`status` is one of `planned`, `active`, `paused`, `complete`, `unreleased`, `handed-off`, or `archived`. With no explicit status, a future `starts` gives `planned`, a past `ends` gives `complete`, a `starts` alone gives `active`, and no dates give `planned`.

An image in `media` needs `kind: image`, `src`, and nonblank `alt`. A purely decorative image sets `decorative: true` with `alt: ''`. The alt text is Willie's. The full policy is in [accessibility.md](./accessibility.md), and `pnpm content:check` enforces it. A video needs `kind: video`, `youtubeId`, and `title`. A document needs `kind: document`, `href`, and `title`.

## Visibility

`public` shows the header, the body, and the media. `facts` shows the header only, which is how an NDA project appears. `hidden` shows nothing, and the project has no page at all. The loader empties the body and the media of any project that is not `public`, so no page or feed can render them by accident.

## Drafts

A file with `draft: true` renders in development and returns 404 in production. Only Willie clears a draft flag. An agent that migrates or adds a project leaves `draft: true` in place.

## Brand

The page wears a Material 3 Fidelity scheme, and neutral colors apply when there is no seed. The seed comes from the first of these that exists.

1. The project's own `brand` field.
2. The seed `pnpm brand:seeds` resolved from the project's `website`, stored by slug in `lib/brand/seeds.json`.
3. The `brand` of the project's first owner that has one.

Run `pnpm brand:seeds` after you add a `website` or after a project's site rebrands. The script reads the live site, so it needs network access.

## Owners

An owner is a key in `OWNERS` in `lib/projects/owners.ts`. To add one, add a key with `name`, an optional `href`, and an optional `brand` that names a key in `lib/brand/seeds.json`. Use the organization's name exactly as Willie's own records spell it. An owner with no `brand` leaves its projects neutral.

## Checking your work

Run `pnpm test && pnpm typecheck`. The tests load every file in `content/projects` through the schema. Run `pnpm content:check` as well when you touch an image.

## Not built yet

The `/projects` list is parked (`routed: false` in `lib/site.ts`) until Willie picks a layout. The steps to unpark it are in `app/_(pages)/README.md`.
