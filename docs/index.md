# About

These pages document [willie.page][website], Willie's personal website, for
whoever maintains it: Willie or an agent. They cover how the site is deployed,
how its content is modeled, and the conventions that govern changes to it.

## Operations

- [Bootstrap](./bootstrap.md): local setup, read-only preflight, and linked
  deployment readiness.
- [Deploying](./deploy.md): hosts, the redirect table, the DNS cutover script,
  and the Vercel versus Cloudflare analysis.

## Content

- [Initiatives](./initiatives.md): the MDX schema for campaigns, series, and
  projects under `/initiatives`, their parts, and the homepage `feature` block.
- [Projects](./projects.md): project categories and the `data/projects.json`
  shape.

## IndieWeb

- [IndieWeb](./indieweb/README.md): every protocol route, the environment
  variables that switch each on, the scripts that run after a build, and the
  IndieMark level 1 to 3 checklist with status.
- [Content](./content/README.md): writing and feed documentation, including
  the frontmatter for notes, replies, likes, reposts, bookmarks, and RSVPs.
- [ActivityPub plan](./future/activitypub.md): what federation would take,
  planned for after launch and not yet started.

## Protocols

- [Protocol easter eggs](./protocols.md): the teapot (`/coffee`, `/tea`),
  `/whoami`, `security.txt`, OpenSearch, and the Clacks header, with how to try
  each and where the limits are.

## Design

- [Design principles](./design-principles.md): the five principles and the brand
  rule that govern the relaunch.
- [Links and hover cards](./links.md): every in-site link goes through
  `SiteLink`, what the hover card shows, and when to turn it off.

## Conventions

- [Commits](./commits.md): Conventional Commit types and scopes.

## Plans and specs

- [Site-wide search and metadata](./superpowers/specs/2026-09-18-static-search-and-metadata-design.md):
  the design, implemented, for ⌘K search and structured data, with its executed
  [plan](./superpowers/plans/2026-09-19-static-search-and-metadata.md).
- [Adaptive theme](./plans/2026-09-19-adaptive-theme.md): the plan, executed,
  that made every surface follow the visitor's light or dark preference.

[website]: https://willie.page
