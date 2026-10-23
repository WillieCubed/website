# Documentation standard

Organize maintainer documentation by the kind of help a reader needs: learning a
process, completing a task, looking up a fact, or understanding a decision. The
site uses [Diátaxis](https://diataxis.fr/) for those distinctions, naming its
four categories Tutorials, Guides, Reference, and Concepts. Concepts corresponds
to Diátaxis explanation; Guides corresponds to how-to guides.

This standard covers placement, navigation, and the information a procedure must
supply. The [editorial principles](editorial-principles.md) govern how to
develop and express that information.

## Choose the reader's need first

### Separate learning, doing, understanding, and lookup

A reader following their first local setup needs a reliable path through an
unfamiliar system. Someone returning to check a frontmatter field needs the
answer quickly. The same material can serve both readers, but the same sequence
rarely does. Choose the primary need before drafting the page.

| Category  | Reader's need                     | Required focus                                                                                                               |
| --------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Concepts  | Understand a system or decision   | Explain relationships, rationale, alternatives, and tradeoffs. Link to procedures and exact contracts.                       |
| Reference | Look up a fact                    | Describe precise schemas, interfaces, configuration, defaults, constraints, and supported behavior. Keep facts easy to scan. |
| Tutorials | Learn through a complete exercise | Provide a controlled starting point and a concrete result through a sequence a newcomer can follow without guessing.         |
| Guides    | Complete a real task              | State prerequisites and give direct steps, relevant choices, verification, and recovery for someone who knows the basics.    |

### Link across categories at the point of need

A procedure needs enough explanation for its reader to choose the next action.
Keep that reasoning beside the choice, then link to Concepts for the fuller
design. Reference works differently: someone looking up a field needs its
allowed values and consequences together, without following an entire exercise
to find them.

When revising a mixed document, split it where readers have genuinely different
tasks. Preserve useful anchors and cross-links. Moving every paragraph of
rationale out of a guide would make it harder to act; copying an entire concept
into each guide would make the documentation harder to maintain.

## Nest by domain

### Keep navigation and paths in agreement

Use `docs/<kind>/<domain>/<topic>.md`. The kinds are `concepts`, `reference`,
`tutorials`, and `guides`; domains include `design`, `content`, `publishing`,
`operations`, and `documentation`. Category first expresses the reading mode;
domain second groups the related systems within it. Add a domain when it helps
someone locate material, rather than creating empty branches for symmetry.

The [documentation README](../../README.md) uses that same order. Use
`README.md` for directory entry points so they appear naturally while browsing
the repository. Its link descriptions should explain what a page helps you do or
understand; the full documentation rules belong here.

A move is complete only when the new path works from its callers. Update links,
source comments, configuration messages, templates, and other path references.
Rebase the moved page's own relative links and check its anchors. A correct
README cannot compensate for a broken link beside the code someone is editing.

### Give historical material an explicit home

Do not commit implementation plans, design specs, or dated verification
records and artifacts. They describe a moment rather than the current system,
and they outlive their usefulness quickly. Keep the decision a plan produced in
the Concept or Reference page it changed, and keep a run's receipts in the pull
request or task that needed them. When a document must cite a historical record,
link a permalink to the commit that contained it; the
[archive](../../README.md#archive) names the last revision with the retired
plans and evidence.

Conceptual proposals belong in Concepts and must identify their proposed status.
A detailed example does not make a proposed integration implemented. If a guide
retains a rollout record for operational context, label its date and link to the
current contract before asking anyone to act.

## Write rigorous tutorials and guides

### Design an exercise someone can finish

A tutorial chooses one path and a controlled starting state. State the learning
goal and observable result first, then establish the tools, versions, access,
working directory, and initial files. Explain costs and external changes before
the exercise creates them. The reader should not discover halfway through that
“setup” means provisioning production.

Provide complete commands or edits in dependency order. Identify every
placeholder and how to obtain its value. Use realistic practice content and keep
credentials out of examples. A first-writing exercise should identify the
filename, frontmatter, local URL, draft behavior, and removal step; merely
linking to the schema leaves the exercise unfinished.

### Check the result, not only the command

Place checkpoints where a reader can distinguish success from partial progress.
In a deployment exercise, installing dependencies and building the site are
preparation. The reader still needs to confirm that the public URL serves the
intended version. If delivery to an outside service is part of the task, give
that delivery its own check. Name the result at each stage so the reader knows
what is complete and what remains. Include likely failure paths and when to stop
instead of retrying a mutation.

End with verification and cleanup. Name the files or resources created by the
exercise and preserve unrelated work. A deployment-from-scratch tutorial must
cover account setup, configuration, provisioning, first deployment, public
runtime checks, and cleanup, while distinguishing practice infrastructure from
production publication.

### Let a guide branch where the real task branches

Guides can assume the domain knowledge linked at their start and offer choices
that a real task requires. They still need precise prerequisites, consequences,
verification, and recovery. Explain the reason for a branch where the reader
selects it; do not make them infer it from two command blocks.

### Describe verification honestly

Check instructions against repository scripts and authoritative documentation.
Before calling a tutorial verified, complete it from its stated starting state
and record the date, environment, outcome, and untested boundaries. If you have
only inspected the source or built the site, say so. That review can catch a
wrong command or missing file, but leaves the fresh-start and hosted steps
untested.

## Check local links and anchors

Run `pnpm docs:check` from the repository root after moving or editing docs. The
checker parses maintained Markdown links and reference definitions, resolves
local files, and checks heading IDs and explicit HTML anchors. It reports the
source file and line for each broken destination. The
[command reference](../operations/commands.md#documentation-and-content-checks)
defines discovery and exclusions. External URLs and runtime links in MDX remain
separate checks.

## Before committing documentation

Read continuously first, then skim the hierarchy. The first pass catches gaps in
reasoning and duplicated introductions; the second checks whether someone
returning with a question can find the relevant answer.

- Apply the [editorial principles](editorial-principles.md), including their
  requirement to develop the motivation for decisions.
- Choose a primary category and useful domain, and add the page to the README.
- Resolve links and anchors, and search for stale paths after a rename.
- Keep implemented contracts, dated observations, and proposals distinguishable.
- Check procedures against their starting states, expected results, and cleanup.
- Preserve evidence limits and state any steps that have not been exercised.

Apply the
[design checklist](../../concepts/design/design-principles.md#before-committing)
when the documentation change also affects public content or the site's
experience. A prose review and an interface review answer different questions.
