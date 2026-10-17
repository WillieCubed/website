# Content

Choose the content model for what you want to publish. A writing is a dated
post, an initiative holds a campaign or series and its parts, and a project
records Willie's work in his exact words. Their fields and publication controls
differ because they present different kinds of material.

## Authoring models

- [Writings](./writings.md) covers dated articles, short notes, media, and
  responses to other posts, whether authored locally or through a publishing
  client. It defines their frontmatter, tags, references, and client edits.
  New client drafts stay in private Studio revisions until publication exports
  the selected content; they do not become public files merely by being saved.
- [Initiatives](./initiatives.md) defines campaigns, series, and projects under
  `/initiatives`, including their numbered parts and homepage placement.
- [Projects](./projects.md) defines one-file project records, ownership,
  visibility, and the requirement to preserve Willie's exact words. A project
  can serve an initiative without becoming one of its numbered parts.

## Publication and discovery

[Feeds](./feeds.md) describes the formats readers subscribe to and the plain
HTML they receive. [Sitemap](./sitemap.md) describes the human directory and
machine discovery sources. Both draw from the published records described above,
so a new post reaches them through its writing file rather than a separately
maintained URL list. The [IndieWeb reference](../publishing/indieweb.md) covers
the publishing endpoints and machine-readable HTML annotations (microformats)
that connect posts to other sites.

[Profile pages](./public-profile.md) records the approval boundary for About
and Research. [Status data and admin](./status.md) defines the separate owner
editor for the public city and weather display. Neither is ordinary MDX
authoring.

## Checks after an edit

Run `pnpm typecheck` and `pnpm test` after content changes. If you change images
or image markup, also run `pnpm content:check`; schema validity alone does not
establish that an image has a useful description. The model references identify
additional checks and the public surfaces to inspect.
