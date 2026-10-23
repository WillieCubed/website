# Studio ownership and publication

Maintainers use this reference to preserve private editor state, revision checks,
and publication recovery. Follow the [private writing guide](../../guides/publishing/private-writing.md)
for access, migration, and owner publication tasks. [Micropub](micropub.md)
defines the protocol adapter into this storage.

## Editor lifetimes

Studio composes document persistence, editor navigation, and publication where
those workflows meet. The document keeps save refs, recovery storage, and head
verification private; views request edits, recovery, or a verified saved revision.
Navigation owns task and preview modes, selection, focus, and scroll. Publication
prepares review data and reports success before navigation opens it. Neither hook
mutates the other's presentation state. The always-mounted publication notice
owns retained-job recovery, polling, connection feedback, and live-completion
notification. A new submission cancels older tracking requests; recovered jobs
must belong to the current writing. Revision history owns its request, error,
and retry only while that task is mounted. The widget generation session owns
its active job and invalidates older recovery or polling responses when a new
request or decision succeeds. Persistent widget forms keep their prompt drafts
when the author switches tasks.

The writing library keeps list loading separate from creation. The new-writing
control owns its pending action and error; a list refresh cannot clear creation
feedback. Article contents observers resolve headings within their own article,
so a retained page cannot supply another article's heading or panel target.

The persistent canvas composes image/link forms, selection controls, and insertion
choices. Forms own their drafts and uploads; selection controls own their placement.
Hiding the canvas for a task or preview retains those owners and the native file
input. One catalog owner refreshes widget entries and supplies the stable read
capability used by the editor. Tasks report approval or restoration instead of
coordinating catalog refs, list setters, or editor/body replacement protocols.

`StudioWriting` keeps document identity as its React key.
`WritingDraftLayout` owns heading visibility and title focus. `WritingCanvas`
retains the editor, media forms, and native file input while tasks and preview
hide the canvas. Views receive the document IDs, revision IDs, body, status,
and actions their work requires; they do not gain persistence authority through
an unused controller contract.

## Publication boundaries

`lib/studio/publication-artifacts.ts` resolves approved widgets and portable
content. `lib/studio/publication.ts` records proposal inputs before sending
retryable GitHub requests through the shared transport. A merge moves the job
toward deployment; Live requires the deployed revision, source hash, and commit
ancestry to match. The store advances the document's live revision
transactionally and never moves it backward. [Music](../content/music.md) keeps
its separate catalog and advisory-lock persistence rules.

A save confirms a private revision. A merge confirms a repository change.
A live result requires deployment verification. The editor must retain those
separate outcomes when a request fails or the owner returns to a retained job.
An old poll cannot replace a newer job or advance another document's revision.
