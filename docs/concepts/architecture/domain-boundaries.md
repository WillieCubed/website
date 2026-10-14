# Architecture

This guide is for Willie or an agent maintaining the website. Modules follow
content and protocol domains; a domain owns its types, transformations, and
storage calls. Routes and components compose those modules. Libraries do not
import routes, UI components, or operational scripts.

## Where code belongs

Choose the role first, then the domain that owns the behavior:

| Location                         | Responsibility                                                            |
| -------------------------------- | ------------------------------------------------------------------------- |
| `app/`                           | Framework route files, metadata, and page composition                     |
| `components/<domain>/`           | The domain's views, hooks, and styles, including route-specific UI        |
| `lib/<domain>/`                  | Application rules, types, parsing, loading, and storage                   |
| `scripts/`                       | Compatible entrypoints for existing commands                              |
| `scripts/<domain>/`              | Commands and their helpers, such as `atproto/`, `content/`, and `deploy/` |
| `tests/unit/<domain>/`           | Individual functions and module behavior                                  |
| `tests/integration/<domain>/`    | Modules working together with an explicitly configured test database      |
| `tests/e2e/site/<domain>/`       | Playwright tests of the built website                                     |
| `tests/e2e/publishing/<domain>/` | End-to-end publishing scenarios using real services                       |
| `tests/support/`                 | Reusable test helpers, setup, and recovery                                |
| `tests/fixtures/`                | Test inputs and standalone assets copied into test infrastructure         |

Keep a scenario's private types and helpers beside it. Move a helper into
`tests/support/` when other scenarios need it or it manages shared test
resources. Application modules never import test code. Test support never
imports scenarios, and scenarios import support directly rather than through
command wrappers. ESLint checks these dependencies, including aliases and
relative imports at any depth.

Within application code, keep the existing domain layout. A route composes
components and libraries; a component renders behavior from libraries; a
library does not import UI. Add code to its owning domain rather than creating
an umbrella utility or repository-wide abstraction.

For example, a writing route stays in `app/writings/`, its rendering belongs
in `components/writings/`, its loading and rules belong in `lib/writings/`,
and its unit tests belong in `tests/unit/writings/`. Search follows the same
pattern, with the palette under `components/search/palette/` and
`lib/search/palette/`. A brand route imports its sections and styles from
`components/brand/`; the admin status route imports its editor from
`components/status/admin/`.

Shared HTTP responses live in `lib/http/`, theme behavior in `lib/theme/`,
and small protocol endpoints in `lib/protocols/`. Keep configuration and the
required framework filenames at their framework-defined locations. Keep
parked routes, unapproved proposals, and unused retained components under
their explicit private or `legacy/` boundaries.

## Shared foundations

`lib/site/identity.ts` defines the site's public identity and deployment
settings. Navigation and publication status for top-level pages live in
`lib/site/navigation.ts`; URL construction lives in `lib/site/urls.ts`.
Date display and publishing timestamps have separate helpers. Social metadata
lives in `lib/seo/metadata.ts`.

Import the module that owns the behavior instead of introducing an umbrella
site module. The URL helpers retain their distinction: `absoluteUrl` resolves
a URL, `canonicalUrl` spells a page's canonical address, and `absoluteRoute`
keeps interpolated routes on the canonical origin.

## Content and protocols

Writings, initiatives, and projects each have a `load.ts` module for filesystem
reading and parsing. They read local files under Node
and bundled content in the Worker through `lib/content/runtime-files.ts`.
Their `index.ts` modules own application access and publication filtering;
build scripts import loaders directly. The Cloudflare runtime uses route
revalidation rather than Cache Components.

`lib/content` owns shared Markdown file IO, date-derived status, and draft
visibility defaults.
Each domain keeps its schema, reserved slugs, ordering, and draft policy.
Collections separate file reading from series composition. Retained loaders
for parked pages live under `lib/legacy/content`; their presence does not make
those pages public or ready for restoration.

Micropub, IndieAuth, and Webmention internals live in their own directories
under `lib/indieweb`. Types belong to their protocol; small shared HTTP and
discovery contracts remain at the IndieWeb root. Micropub separates parsing,
validation, serialization, frontmatter-preserving edits, and persistence.
AT Protocol response modules separate fetching, normalization, refresh checks,
and merging. Owner-copy validation is independent of the Bluesky publishing
orchestrator, so metadata validation does not create a runtime import cycle.

## UI and styles

The palette session, homepage detail controller, and Standard social controller
own request lifecycles, selection, transitions, and focus behavior. Their views
render the corresponding state. Brand sections and downloads are separate
components. Keep client directives on controllers and interactive views; keep
filesystem and provider modules out of their import trees.

The homepage, shared chrome, and brand stylesheet entry points import ordered
section styles. Preserve this order when editing them: responsive and
accessibility overrides depend on the cascade. Extracting a component must not
add a wrapper element or change its focus, transition, or accessible-name
contract. Follow [links](../../reference/design/links.md) and [design principles](../design/design-principles.md).

## Publishing end-to-end tests

Retained identity, social capture, hosted response, Standard.site, and media
verification commands keep their existing filenames and CLI options. The retired
Vercel-only bootstrap, TOTP setup, cutover, migration, and live-media creation
commands have no current entrypoint; their dated evidence remains in the archive. Their
entrypoints guard execution; importing one does not run it. Implementations
live under `tests/e2e/publishing`, grouped by protocol. Shared accounts,
fixtures, browser helpers, and recovery code live under
`tests/support/publishing`. The standalone SMTP receiver copied into the test
PDS lives under `tests/fixtures/atproto`. Test resources are separate from
maintenance commands in `scripts/`.

Existing root scripts delegate to those modules and retain the old filenames,
CLI options, and exports for saved commands and recovery instructions. New
code imports its owning module directly. Scenario entrypoints can also run
directly; importing them does not initiate provider operations. Shared
`tests/support/publishing/runtime.mts` resolves checkout paths independently
of the caller's working directory.

Retained runtime identifiers, journal formats, ownership checks, cleanup
ordering, and private-file permissions remain part of the recovery contract.
An extraction is not a reason to accept a foreign record or adopt an
unjournaled mutation. Offline tests exercise journal ownership and interrupted
mutation recovery using temporary files and injected operations.

New verification receipts can include `verifierSourceFiles`; callback-delivery
proofs also include `probeSourceFiles`. These maps hash the entrypoint and its
local source dependencies without executing them. The existing entrypoint
hash remains present. Older receipts without a module manifest remain readable
and retain their original scope. Cleanup preserves the original verification
manifest (including its absence on older receipts) and records the cleanup
implementation separately in `cleanupSourceFiles`. Historical specs and evidence may refer to
paths from the previous layout; they are retained records, not current module
maps or proof of this refactor.

## Verification

Custom ESLint rules, processors, and configuration use TypeScript and are
included in type checking. The root JavaScript entrypoint only re-exports the
typed configuration: this keeps the standard ESLint command working without
loader flags or an additional runtime loader. Node 24 loads the typed modules
through its native type stripping.

Code comments explain behavior and invariants rather than pointing to literal
filenames or paths. When a symbol reference is useful, use a TSDoc link such
as `{@link getWriting}`. The `site/no-file-references` ESLint rule checks source
comments, including stylesheets, shell/environment documentation, and workflow
configuration. Imports, runtime paths, and test input strings are executable
data and are not checked as documentation.

Endpoint comments describe the handler a contributor is reading: start with
what the request returns or changes, then explain required inputs,
authentication, and meaningful failure cases. Document each HTTP method
separately instead of describing neighboring handlers or how the code is laid
out. Maintainer endpoint tables describe HTTP methods, inputs, and responses.
Directory maps and implementation navigation belong in maintainer guides such
as this one.

Run `pnpm check` for unit tests, ESLint, full TypeScript checking (including
all `.mts` scripts and tests), and a production build. ESLint rejects unused
bindings, explicit `any`, CommonJS entry points, and dependencies that cross
the boundaries above. Run `pnpm test:e2e` against the built local site for browser
and accessibility coverage.

Compare representative pages at 390px and desktop widths in both themes when
changing component composition or style ownership. Check keyboard navigation,
reduced motion, dialogs, the footer dock, and shared-element transitions.
Local checks do not establish provider or production acceptance. Follow
[publishing verification](../../guides/publishing/publishing-verification.md) when that separate work
is authorized; ordinary refactoring does not run live publishing tests. See [Testing](../../reference/operations/testing.md)
for which checks to run and how CI uses them.
