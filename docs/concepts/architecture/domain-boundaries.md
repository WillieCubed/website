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

The palette session and homepage detail controller own request lifecycles,
selection, transitions, and focus behavior. The Standard social controller owns
confirmed subscriptions and recommendations; the sign-in dialog owns its form,
request cancellation, and modal lifecycle. Their views render the corresponding
state. Action definitions keep button labels, progress, failures, and undo behavior
together so the view and controller describe the same operation. Brand sections and downloads are separate
components. Keep client directives on controllers and interactive views; keep
filesystem and provider modules out of their import trees.

State belongs to the lowest common owner that reads and changes it, with a
lifetime long enough to preserve the user's work. Keep form fields, dialog DOM
refs, and focus handling near their consumers. Keep a shared document, autosave
queue, and recovery state alive for the document's lifetime. Moving state closer
to a view must not reset a mounted editor or a native file draft when the user
opens a preview, visits a task, or moves through setup. Selection and the return
from a task stay with the common owner that coordinates those transitions.

Studio composes document persistence, editor navigation, and publication where
those workflows meet. The document keeps save refs, recovery storage, and head
verification private; views request edits, recovery, or a verified saved revision.
Navigation owns task and preview modes, selection, focus, and scroll. Publication
prepares review data and reports success before navigation opens it. Neither hook
mutates the other's presentation state.

The persistent canvas composes image/link forms, selection controls, and insertion
choices. Forms own their drafts and uploads; selection controls own their placement.
Hiding the canvas for a task or preview retains those owners and the native file
input. One catalog owner refreshes widget entries and supplies the stable read
capability used by the editor. Tasks report approval or restoration instead of
coordinating catalog refs, list setters, or editor/body replacement protocols.

Music's admin controller composes draft persistence and recovery, library
imports, revision history, and publication tracking. The draft owner keeps
the optimistic revision, pending edits, and save queue together; views use
commands such as recovering a draft or restoring a revision. They do not
receive mutable save refs. The browsing experience separates catalog editing
and prototype storage from setup and review transitions. Its rail owns series
text editing, and its review dialog owns its DOM and focus lifecycle. Their
common owner coordinates opening across siblings so those local interactions
share one consistent view of which surface is open. Playlist navigation keeps
URL history, modal focus, and motion together. Cards receive prepared playlist
and series previews rather than the complete library and catalog. Each admin
operation owns its errors; successful publication polling cannot clear a failed
save or history request. Palette commands request playlist opening through the
same navigation owner as links, with an explicit destination collection.

Status follows the same distinction between editing and access. `LocationEditor`
calls its editor hook locally, keeping location fields and save behavior with
the form. The access root controls the authentication view; an explicit
access-expiry callback lets the editor report lost access without giving that
root ownership of the form. Public status refresh owns the last available
snapshot; expanded clock and weather views own timezone, temperature units, and
animation. Compact views do not create those detail-only interactions.

Keep hook interfaces cohesive. A catalog document exposes edits to its live and
draft values; prototype storage reports readiness and storage errors; a modal
owns opening, dismissal, and focus. Compose these owners where their workflows
meet. Do not flatten unrelated state, setters, refs, and commands into a single
hook result or conceal that result under a few broad object keys. Each interface
should express a domain responsibility that its consumers can understand on its
own. Pure catalog transformations belong in the music domain rather than inside
a state hook.

The palette's search hook owns request progress, timeouts, and stale-query
results. Its session composes those results with commands and owns keyboard
selection and command execution. Loading feedback and the native search
recovery link render from the same request state.

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

## Complexity and readability

Prefer code a maintainer can follow in one direction: read inputs, make the
domain decision, perform the effect, and return the result. Separate request
lifecycle from rendering and pure transformations from persistence. Keep state
with the component that owns its lifetime; a sign-in form should not make the
social controller manage its field errors or abort controller.

Extract a module when it gives a responsibility a useful name and a small
interface. Avoid passing an entire controller into a component that needs only
an open flag and a dismiss callback. A helper that merely hides a conditional,
a wrapper that forwards every argument, or a general framework for two concrete
operations can increase the amount a reader must understand. Delete redundant
branches and derived state before introducing another abstraction.

Name component contracts with the domain types they represent, such as `Part`,
`Initiative`, `Draft[]`, or `WritingDocument`. A collection response, stored
record, publication result, or controller has one contract owned by the module
that defines its meaning. Producers declare that contract; consumers import it
instead of calculating it from a loader or hook implementation. Declare named
props interfaces and records instead of inline object type definitions or utility
fragments in parameter contracts. Compare numeric counts explicitly, such as
`items.length > 0`, rather than treating a count as a boolean. Use focused
view props and action capabilities rather than passing an entire controller to
a panel that needs only a few fields.

Keep utility types when they express a clear relationship: native React element
props, a small subset of a domain record, vendor parser adapters, and timer
handles are useful examples. Avoid chains of `ReturnType`, `Awaited`, and
`NonNullable` when an existing domain contract already says what the value is.
Do not replace inference with a new name that merely conceals the same calculation.

For Next.js pages, use generated `PageProps<'/route'>`; route handlers use
`RouteContext<'/route'>`. Social image functions can select the page's generated
params contract without claiming to receive search params. These helpers keep
params asynchronous and check their keys against the route. Query values may
be repeated, so narrow arrays at the request boundary before passing a query to
a domain operation. ESLint's standard `no-restricted-syntax` rule rejects three
nested inference utilities in UI code and handwritten promised params shapes in
pages. These checks catch patterns; they cannot judge whether a contract has the
right responsibility or belongs to the right owner.

ESLint enforces cyclomatic complexity of at most 10, cognitive complexity of at
most 15, and block nesting of at most 4 across JavaScript and TypeScript,
including `.mts` scripts and tests. The simplified Standard social modules also
reject nested ternaries. These limits identify review targets; they do not
establish good architecture. Preserve meaningful domain operations instead of
splitting them into arbitrary pieces to lower a score.

UI modules enforce standard ESLint size limits as errors:
`max-lines-per-function` permits at most 150 nonblank, non-comment lines,
including immediately invoked functions; `max-statements` permits at most 30
statements. Nested effect and callback bodies are checked separately, and their
lines also count toward their enclosing function. The rules cover app and
component modules, including route handlers, hooks, and JSX-heavy renders.
Pre-commit and CI reject violations. Both lint commands use `--max-warnings 0`,
so warnings cannot silently pass either gate.

Meeting a size limit also requires a responsibility review. Identify what the
function owns, which consumers need its state, and what its public props or hook
result require a caller to understand. A small hook that forwards a broad
controller can still need work.

Extract a part when it owns a distinct responsibility or lifecycle. Keep state
with its lowest common consumer, while preserving mounted lifetimes needed for
drafts, native file inputs, selection, and focus. Composition should reduce
coordination at the caller. Avoid new forwarding layers, large return objects
spread across hooks, compressed formatting, or moving the same controller into
another file. No standard size rule can establish SRP or correct state ownership;
the pull request template makes those explicit review checks. Do not raise limits,
add baselines or per-file exceptions, or suppress findings to make a refactor pass.

Run `pnpm exec eslint . --format json` to inspect findings with file, line,
rule, and diagnostic information. The codebase has no complexity baseline or
exemptions. Do not raise limits or add suppressions to make a refactor pass.
Review touched code for readable responsibilities and dependency direction even
when lint passes.

UI contracts use named interfaces. Standard `no-restricted-syntax` selectors
reject inline object parameter types (including defaulted props), inline props
for `FC`/`FunctionComponent`/`ComponentType` and `memo`/`forwardRef`, and utility fragments such as `Pick` in parameters
or property contracts. `@typescript-eslint/consistent-type-definitions` requires
interfaces for object definitions in app and component modules. Named union
and utility aliases remain useful for domain types that cannot be interfaces.

`@typescript-eslint/strict-boolean-expressions` rejects number and nullable-number
truthiness throughout JavaScript and TypeScript. Compare counts explicitly:
`items.length > 0`, `(items?.length ?? 0) > 0`, or `count === 0`. Check optional
identifiers for absence rather than conflating absence with zero. Numeric defaults
and sort results need particular care: preserve whether zero and `NaN` select a
fallback, and preserve negative comparator results. String, nullable-boolean,
and nullable-object checks remain allowed; mixed types need explicit checks.

Both gates run through the existing Husky pre-commit hook and required CI lint
job. Pre-commit uses `lint-staged` with `eslint --fix`; CI uses `pnpm lint` over
the whole repository. Typed lint reads the TypeScript project, including supported
JavaScript files and hidden route modules. The pre-commit command does not cache
results because inferred types can change through imported declarations. No
custom checker or baseline is needed, and lint success still requires architectural
review of responsibilities and state ownership.

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
