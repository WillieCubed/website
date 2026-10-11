# About

These pages document [willie.page][website], Willie's personal website, for
whoever maintains it: Willie or an agent. They cover how the site is deployed,
how its content is modeled, and the conventions that govern changes to it.

## Operations

- [Bootstrap](./bootstrap.md): local setup and Cloudflare deployment prerequisites.
- [Deploying](./deploy.md): hosts, redirects, Cloudflare resources, and cutover checks.

## Content

- [Profile proposals](./public-profile.md): unrouted About and Research sources
  and the explicit approval required before public release.

- [Sitemap](./sitemap.md): the human directory, XML sitemap, and shared
  programmatic resource catalog.

- [Media mentions](./media.md): verified coverage, optional excerpts and
  images, and the compact `/media` page.
- [Initiatives](./initiatives.md): the MDX schema for campaigns, series, and
  projects under `/initiatives`, their parts, and the homepage `feature` block.
- [Projects](./projects.md): the one-file-per-project schema, visibility, and
  the rule that every word is Willie's.

## IndieWeb

- [IndieWeb](./indieweb/README.md): every protocol route, the environment
  variables that switch each on, the scripts that run after a build, and the
  IndieMark level 1 to 3 checklist with status.
- [AT Protocol](./atproto.md): the Bluesky handle, the standard.site
  publication, document sync, and visitor subscriptions and recommendations.
- [Publishing conformance](./publishing-conformance.md): inspected standards,
  implementation coverage, external results and unresolved release gates.
- [Publishing verification](./publishing-verification.md): isolated acceptance
  runners, real account checks, receipt requirements and cleanup.
- [Content](./content/README.md): writing and feed documentation, including
  the frontmatter for notes, replies, likes, reposts, bookmarks, and RSVPs.
- [ActivityPub plan](./future/activitypub.md): what federation would take,
  planned for after launch and not yet started.

## Protocols

- [Protocol easter eggs](./protocols.md): the teapot (`/coffee`, `/tea`),
  `/whoami`, `security.txt`, OpenSearch, and the Clacks header, with how to try
  each and where the limits are.

## Design

- [Accessibility](./accessibility.md): image descriptions, publication gates,
  interaction rules, and audit evidence.
- [Design principles](./design-principles.md): the five principles and the brand
  rule that govern the relaunch.
- [Links and hover cards](./links.md): every in-site link goes through
  `SiteLink`, what lint enforces, when a raw anchor is right, what the hover
  card shows, and when to turn it off.
- [Brand kit and logo rules](./brand.md): where the WillieCubed files and
  their usage rules come from, what `pnpm brand:build` writes, and the one
  exception the site itself makes.
- [Titles and social previews](./metadata.md): `og:site_name` carries the
  name, so no social title repeats it, and every title reads on its own.

- [Status data and admin](./status.md): manual city source, owner sign-in,
  caching, and the future Docket boundary.

## Conventions

- [Commits](./commits.md): Conventional Commit types and scopes.

## Plans and specs

- [Website issue plan](./plans/2026-10-11-website-issues.md): the Music gallery,
  private curation, and gated About release. Research is deferred.

- [Site-wide search and metadata](./superpowers/specs/2026-09-18-static-search-and-metadata-design.md):
  the design, implemented, for ⌘K search and structured data, with its executed
  [plan](./superpowers/plans/2026-09-19-static-search-and-metadata.md).
- [Adaptive theme](./plans/2026-09-19-adaptive-theme.md): the plan, executed,
  that made every surface follow the visitor's light or dark preference.
- [willie.page in the Atmosphere](./superpowers/specs/2026-10-02-atmosphere-design.md):
  the original design for standard.site publishing and AT Protocol interop.
  The conformance guide records current behavior and external verification.
  Its plans cover [standard.site](./superpowers/plans/2026-10-02-standard-site.md)
  and [Bluesky posting and responses](./superpowers/plans/2026-10-02-bluesky-posse.md).
- [Project model and pages](./superpowers/plans/2026-09-28-project-model-and-pages.md):
  the plan, executed, for one validated file per project and a page
  for every project. The public index uses already-public homepage work and
  excludes draft project files.

[website]: https://willie.page
