# Documentation

The maintainer docs explain how to build, publish, and care for
[willie.page](https://willie.page). Choose a tutorial to learn through a local
exercise, a guide to complete a task, Reference to look up a contract, or
Concepts to understand a design decision.

To begin working in the repository, follow
[local setup](./tutorials/operations/local-development.md), then try
[your first writing page](./tutorials/content/first-writing.md). The
[design principles](./concepts/design/design-principles.md) describe the
experience those changes should preserve.

## Concepts

Understand why the site works this way and how its parts fit together.

### Design

- [Design principles](./concepts/design/design-principles.md): the seven
  principles, their rationale, visual direction, and the review checklist used
  before committing.

### Publishing

- [Independent publishing](./concepts/publishing/independent-publishing.md): how
  identity, content, feeds, responses, and AT Protocol fit together.
- [ActivityPub proposal](./concepts/publishing/activitypub.md): a future
  federation design; this is not an implemented capability.

### Architecture

- [Domain boundaries](./concepts/architecture/domain-boundaries.md): module ownership, dependency direction, and state lifetimes.

## Reference

Look up exact rules, schemas, commands, routes, and supported behavior.

### Documentation

- [Editorial principles](./reference/documentation/editorial-principles.md):
  voice, character, tone, and structure.
- [Documentation standard](./reference/documentation/organization.md): choosing
  a documentation type, domain nesting, required content, and review checks.

### Design

- [Interaction states](./reference/design/interactions.md): shared Expressive
  pressed shapes, keyboard focus, target sizes, and reduced-motion behavior.
- [Spacing](./reference/design/spacing.md): semantic spacing roles, the 4px
  grid, optical exceptions, and source validation.
- [Accessibility contract](./reference/design/accessibility.md): image
  descriptions, interaction rules, publication gates, and the limits of recorded
  audit evidence.
- [Loading and continuity](./reference/design/loading.md): content-first rendering, persistent layouts, motion, bounded waits, and recovery.
- [Links and hover cards](./reference/design/links.md): `SiteLink`, raw-anchor
  exceptions, entity previews, and lint rules.
- [Brand kit and logo rules](./reference/design/brand.md): generated assets and
  logo usage.
- [Titles and social previews](./reference/design/metadata.md): metadata rules
  and shared helpers.

### Content

- [Music operations](./reference/content/music.md): playlist storage, provider configuration, owner roles, and refresh verification.
- [Content catalog](./reference/content/README.md): entry point for content
  models.
- [Writings](./reference/content/writings.md): frontmatter, post kinds, tags,
  references, and draft behavior.
- [Feeds](./reference/content/feeds.md): RSS, Atom, and JSON feed routes and
  inclusion rules.
- [Initiatives](./reference/content/initiatives.md): campaigns, series, parts,
  and homepage features.
- [Projects](./reference/content/projects.md): project files, visibility, and
  authorship rules.
- [Media mentions](./reference/content/media.md): coverage sources, excerpts,
  images, and rendering.
- [Sitemap](./reference/content/sitemap.md): the human directory and shared
  resource catalog.
- [Status data and admin](./reference/content/status.md): status sources,
  sign-in, and caching.
- [Profile pages](./reference/content/public-profile.md): the approval boundary
  for About and Research.

### Publishing

- [AT Protocol](./reference/publishing/atproto.md): publication identity,
  document records, configuration, and Standard.site and Bluesky interactions.
- [IndieWeb index](./reference/publishing/indieweb.md): protocol entrypoints and
  retained links from the former combined reference.
- [Discovery and routes](./reference/publishing/indieweb-discovery.md): endpoint
  inventory and database boundaries.
- [Shared protocol configuration](./reference/publishing/indieweb-configuration.md):
  bindings, secrets, commands, and migration order.
- [Microformats](./reference/publishing/microformats.md): authors, entries,
  collections, events, and response markup.
- [Webmention](./reference/publishing/webmention.md): verification, moderation,
  delivery, Vouch, and Salmention.
- [Micropub and media](./reference/publishing/micropub.md): authenticated source
  operations, private draft boundaries, uploads, and public byte delivery.
- [IndieAuth](./reference/publishing/indieauth.md): owner consent, PKCE,
  token rotation, replay, and UserInfo.
- [Studio ownership](./reference/publishing/studio.md): editor lifetimes,
  revisions, and publication recovery.
- [Supported behavior](./reference/publishing/indieweb-spec.md): the protocol
  contract clients can rely on.
- [IndieMark checklist](./reference/publishing/indiemark.md): requirements and
  repeatable public checks.
- [Publishing conformance](./reference/publishing/publishing-conformance.md):
  local, hosted, provider, and independent evidence requirements.
- [Protocol easter eggs](./reference/publishing/protocols.md): `/coffee`,
  `/tea`, `/whoami`, discovery, and headers.

### Operations

- [Commands](./reference/operations/commands.md): package scripts and focused
  documentation/content checks.
- [Build metrics](./reference/operations/build-metrics.md): definitions and
  collection boundaries for the Cloudflare build and local browser measurements.
- [Site build record](./reference/operations/build-record.md): artifact versions,
  build timestamps, and links to the producing CI run.
- [Testing](./reference/operations/testing.md): suite boundaries and the checks appropriate to a change.

- [Setup and deployment checks](./reference/operations/bootstrap.md): local setup, Cloudflare account and resource requirements, and current verification limits.
- [Commit conventions](./reference/operations/commits.md): types, scopes, and
  design review.

## Tutorials

Learn by building something step by step.

### Operations

- [Run the site locally from a fresh checkout](./tutorials/operations/local-development.md):
  install the locked dependencies, run checks, and open the local site.

### Content

- [Add your first writing page locally](./tutorials/content/first-writing.md):
  create a draft article, inspect its page, and remove the practice content.

## Guides

Complete a task in an existing checkout or deployment.

### Operations

- [Diagnose loading and repeated work](./guides/operations/performance.md):
  comparable measurements, cache ownership, prefetch, previews, and media.
- [Deploy and change domains](./guides/operations/deploy.md): current hosting,
  domain attachment, DNS cutover checks, and dependency patch maintenance.

### Publishing

- [Private writing preview](./guides/publishing/private-writing.md): Access, private storage, draft migration, and owner-approved publication.
- [Run IndieWeb HTTP checks](./guides/publishing/indieweb-testing.md): local and
  isolated write checks.
- [Verify publishing](./guides/publishing/publishing-verification.md): what a
  hosted publishing run must observe, and the release checks.
- [Review writing before publication](./guides/publishing/publication-review.md):
  the draft-specific factual, authorship, and syndication questions to resolve
  before publication.

## Archive

Design proposals, implementation plans, rollout records, and dated verification
records are not kept in the tree. The last revision that contained them is
[`566f37b5`](https://github.com/WillieCubed/website/tree/566f37b570df167f917f20217ee6fcd5131d12a8/docs); read them there for historical context, and use the
references and guides above for current behavior and procedures.
