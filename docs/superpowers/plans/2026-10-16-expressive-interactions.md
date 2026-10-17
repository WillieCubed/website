# Expressive Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize Material 3 Expressive control states across Music and the website while preserving native navigation, distinctive card motion, and stable containers.

**Architecture:** A globally loaded `site-control` CSS primitive owns target sizing, size-specific pressed corners, one focus indicator, disabled guards, and reduced motion. Existing components retain their semantic elements, resting shapes, color roles, selection authority, and handlers. `Button` adopts the primitive automatically; bespoke action surfaces opt in explicitly.

**Tech Stack:** Next.js 16.3.8, React, TypeScript, native CSS interaction states, Playwright.

**Spec:** [Interaction states](../../reference/design/interactions.md).

## Global Constraints

- Small controls retain at least 48px targets and use 8px pressed corners; medium controls use 56px targets and 12px pressed corners.
- Keyboard focus, press, disabled, expanded, and confirmed selection remain distinct.
- Connected controls retain their position and size during press; their inner gap is 2px with a documented spacing exception.
- No one-sided borders, hidden initial content, new provider writes, or lost functionality.
- Preserve editor selection and draft lifetimes, link destinations, dialog/history behavior, and native forms.
- Reduced motion removes geometric animation while keeping immediate state feedback.
- Every visual iteration includes uncropped mobile and desktop captures; production acceptance requires exact hosted revision and rendered behavior.

## Review Focus

- Focused or disabled controls must not acquire a pressed/selected shape or activate unexpectedly.
- Compact buttons must remain reachable without overlapping adjacent targets, editor text, or footer controls.
- Native links and forms must remain useful without scripts; rich-editor selection must survive toolbar use.
- Rapid arrow navigation must retain the detail container shape and avoid stale transition callbacks.
- Narrow screens, reduced motion, and forced colors must preserve one clear focus indicator and readable content.

### Task 1: Shared primitive and Music

**Files:** `app/globals.css`, `components/site/styles/interactions.css`, `components/site/styles/buttons.css`, `components/site/Button.tsx`, `components/music/music-prototype.css`, `scripts/design/spacing-exceptions.json`, `docs/reference/design/spacing.md`, `tests/e2e/site/music/music-eggs.spec.mts`.

**Interfaces:** `.site-control`; optional `data-control-size="medium"|"large"`; shared `--control-target`, `--control-pressed-radius-*`, `--control-focus-*`, and control motion tokens. Component styles may set resting shape and state colors.

- [ ] Confirm the failing normal-motion artwork, snapshot-shape, and held-control regressions.
- [ ] Implement the shared primitive, adopt it in `Button` and Music action roots, and remove conflicting local press/focus rules.
- [ ] Document the connected-group spacing exception and link the shared contract from the docs index.
- [ ] Run Music keyboard, press, transition, native-route, and curation/footer checks in both viewport classes and themes; verify WebKit's fallback.

### Task 2: Public action surfaces

**Files:** Public search, shared chrome/footer, homepage action controls, status controls, brand actions, media retry/disclosures, and action-like project/initiative links identified by the source inventory.

**Interfaces:** Consume Task 1's `.site-control` and size tokens; preserve custom cards and ordinary link semantics.

- [ ] Add state-specific browser regressions for shared compact and medium actions, disabled controls, stable neighbors, focus, and reduced motion.
- [ ] Adopt the primitive on actual actions; remove duplicate ring and conflicting press/expanded rules; preserve personalized card motion under normal preference.
- [ ] Verify production-build public routes, navigation, disclosures, responsive layouts, and full viewport captures.

### Task 3: Writings and private controls

**Files:** Public writing/social controls, Studio control styles and raw action roots, status admin, Webmention form, code-copy action, and error retry.

**Interfaces:** Consume Task 1's primitive; preserve native forms, editor selection, confirmed provider state, and private fixture isolation.

- [ ] Add focused regression coverage for pressed versus focused/selected split controls, disabled actions, native fallback links, and editor selection lifetime.
- [ ] Migrate bespoke actions and local target overrides; retain text-field/editor focus and active-descendant semantics.
- [ ] Run isolated Studio and social fixtures, public native-route checks, and mobile/desktop captures without invoking publishing/provider mutation workflows.

### Task 4: Integration and release

**Files:** Shared interaction browser tests and documentation; repository release artifacts remain outside tracked source.

- [ ] Reconcile the source inventory against migrated controls and deliberate component-specific exceptions.
- [ ] Run `pnpm check`, production-build browser smoke, and the affected isolated suites sequentially.
- [ ] Review the complete diff, commit with the repository's atomic staging workflow, and use its PR template.
- [ ] Rebase-merge after required checks; verify Cloudflare's exact production revision and actual public interactions.
