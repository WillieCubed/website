# Content

The site has three editorial models. Writings are dated posts; initiatives
hold a campaign or series and its parts; projects record Willie's work under
an explicit authorship rule. Choose the model before adding a file: the
choice determines its URL, fields, presentation, and publication controls.

## Authoring models

- [Writings](./writings.md) defines article, note, photo, and interaction-post
  frontmatter, tags, references, and Micropub edits. Start here for a dated post.
- [Initiatives](./initiatives.md) defines campaigns, series, and projects under
  `/initiatives`, including their numbered parts and homepage placement.
- [Projects](./projects.md) defines one-file project records, ownership,
  visibility, and the requirement to preserve Willie's exact words. A project
  can serve an initiative without becoming one of its numbered parts.

## Publication and discovery

[Feeds](./feeds.md) describes the formats readers subscribe to and the plain
HTML they receive. [Sitemap](./sitemap.md) describes the human directory and
machine discovery sources. These are consumers of published content; adding a
URL to a directory is not a substitute for publishing through its content model.
The [IndieWeb reference](../publishing/indieweb.md) covers the protocol endpoints
and microformats that connect posts to other sites.

[Profile proposals](./public-profile.md) records the approval boundary for About
and Research. [Status data and admin](./status.md) defines the separate owner
editor for the public city and weather display. Neither is ordinary MDX authoring.

## Checks after an edit

Run `pnpm typecheck` and `pnpm test` after content changes. If you change images
or image markup, also run `pnpm content:check`; schema validity alone does not
establish that an image has a useful description. The model references identify
additional checks and the public surfaces to inspect.
