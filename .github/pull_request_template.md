## TL;DR

<!-- One or two sentences: what changes for a visitor or a maintainer, and why. -->

## Changes

<!-- What changed, grouped by area. Name the files a reviewer should read first. -->

## Verification

<!-- How you know it works: the commands you ran (`pnpm check`), the pages you
opened and at what widths and colour schemes, and any production check that
has to wait until after deploy. -->

<!-- For UI changes, complete these checks and explain retained size warnings in
Changes. For other changes, say that the UI checks are not applicable. -->

- [ ] Reviewed reported UI size warnings and explained retained large functions.
- [ ] Checked each component or hook's responsibility and public interface.
- [ ] Checked state ownership and draft, native-input, selection, and focus lifetimes.
- [ ] Each extraction owns a distinct responsibility or lifecycle and reduces caller coordination.

## Follow-ups and Next Work

<!-- Anything left undone, found along the way, or unblocked by this PR.
Write "None." if there is nothing. -->
