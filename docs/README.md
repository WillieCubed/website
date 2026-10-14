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

## Reference

Look up exact rules, schemas, commands, routes, and supported behavior.

### Documentation

- [Editorial principles](./reference/documentation/editorial-principles.md):
  voice, character, tone, and structure.
- [Documentation standard](./reference/documentation/organization.md): choosing
  a documentation type, domain nesting, required content, and review checks.

### Design

- [Accessibility contract](./reference/design/accessibility.md): image
  descriptions, interaction rules, publication gates, and the limits of recorded
  audit evidence.
- [Links and hover cards](./reference/design/links.md): `SiteLink`, raw-anchor
  exceptions, entity previews, and lint rules.
- [Brand kit and logo rules](./reference/design/brand.md): generated assets and
  logo usage.
- [Titles and social previews](./reference/design/metadata.md): metadata rules
  and shared helpers.

### Content

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
- [Profile proposals](./reference/content/public-profile.md): retained About and
  Research sources and their publication constraints.

### Publishing

- [AT Protocol](./reference/publishing/atproto.md): publication identity,
  document records, configuration, and Standard.site and Bluesky interactions.
- [IndieWeb routes and configuration](./reference/publishing/indieweb.md):
  endpoints, environment variables, microformats, and operating details.
- [Supported behavior](./reference/publishing/indieweb-spec.md): the protocol
  contract clients can rely on.
- [IndieMark checklist](./reference/publishing/indiemark.md): requirements and
  recorded status.
- [Publishing conformance](./reference/publishing/publishing-conformance.md):
  standards coverage, external evidence, and unresolved release gates.
- [Protocol easter eggs](./reference/publishing/protocols.md): `/coffee`,
  `/tea`, `/whoami`, discovery, and headers.

### Operations

- [Bootstrap and preflight](./reference/operations/bootstrap.md): phases, flags,
  selected projects, resource changes, and readiness limits.
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

- [Deploy and change domains](./guides/operations/deploy.md): current hosting,
  domain attachment, DNS cutover checks, and dependency patch maintenance.

### Publishing

- [Run IndieWeb HTTP checks](./guides/publishing/indieweb-testing.md): local and
  isolated write checks.
- [Verify publishing](./guides/publishing/publishing-verification.md): account
  acceptance runners, receipts, recovery, and cleanup.
- [Review writing before publication](./guides/publishing/publication-review.md):
  the draft-specific factual, authorship, and syndication questions to resolve
  before publication.
- [Production rollout](./guides/publishing/production-rollout.md): September 23
  rollout record, observed checks, and publication gates; follow current
  references before acting.

## Archive

Design proposals, implementation plans, and dated verification records. Use the
references and guides above for current behavior and procedures.

- [Search and metadata design](./superpowers/specs/2026-09-18-static-search-and-metadata-design.md)
  and [plan](./superpowers/plans/2026-09-19-static-search-and-metadata.md).
- [Adaptive theme plan](./plans/2026-09-19-adaptive-theme.md).
- [Atmosphere design](./superpowers/specs/2026-10-02-atmosphere-design.md),
  [Standard.site plan](./superpowers/plans/2026-10-02-standard-site.md), and
  [Bluesky plan](./superpowers/plans/2026-10-02-bluesky-posse.md).
- [Project model plan](./superpowers/plans/2026-09-28-project-model-and-pages.md).
- [Command palette design](./superpowers/specs/2026-09-23-command-palette-design.md),
  [footer sheet design](./superpowers/specs/2026-09-23-footer-sheet-design.md),
  and
  [rail focuses design](./superpowers/specs/2026-09-23-rail-focuses-design.md).
- [Scrollbar design](./superpowers/specs/2026-09-28-scrollbars-design.md) and
  [plan](./superpowers/plans/2026-09-28-scrollbars.md).
- [Acceptance identity plan](./superpowers/plans/2026-10-08-acceptance-identities.md).
- [September 23 verification](./evidence/publishing/verification-2026-09-23.md)
  and [follow-up](./evidence/publishing/verification-2026-09-23-followup.md).
- [Evidence artifacts](./evidence/): dated receipts and screenshots, interpreted
  by the conformance and verification documents.
