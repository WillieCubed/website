# Loading UX resolution

## Acceptance contract

Present available content in server HTML. Loading must preserve the page's navigation, column, controls, media geometry, and reading position. Use one composition for pending, ready, empty, and failed states; placeholders belong only to unknown data. Keep refreshes local and preserve usable content and edits. Native links, forms, and meaningful values are the baseline; enhancement never makes them less useful. Follow MD3 Expressive motion with shared tokens, reduced motion, visible progress, accessible status, and actionable bounded failures.

## Work

1. Recheck the prior loading audit against current routes, including Music and Studio. Add structural pending/ready regression coverage with held and failed responses.
2. Remove unnecessary server fallback swaps on Music, search, home values, and admin. Keep Music curation in its gallery composition while data arrives and fails. Preserve approval and freshness restrictions on public music.
3. Fix query races, pending/empty/error distinctions, recovery, stable geometry, and announcements in instant search. A native search destination remains available when enhancement fails.
4. Make home details and controls progressively enhanced. Preserve truthful values, native destinations, deliberate motion, and the footer's hydration geometry.
5. Standardize asynchronous action slots, busy semantics, progress contrast, time limits, and retry behavior. Preserve drafts and cached content on failures.
6. Reserve media geometry and retain meaningful external destinations when media providers fail. Bound optional server requests without moving primary content out of its semantic container.
7. Verify every audit item against the acceptance criteria, plus all new Music/Studio surfaces, with unit/integration checks and full viewport desktop/mobile evidence. Document the enduring loading contract in the design reference.

## Validation

Test direct navigation and native submissions without JavaScript; cold and warm loads; delayed, aborted, failed, and stale responses; repeated actions; route interruption; focus and edits; live reduced motion; light and dark themes; narrow and wide viewports. Measure unexpected layout shifts separately from intentional transforms. Use isolated fixtures for private workflows and never publish test content or change real account state.
