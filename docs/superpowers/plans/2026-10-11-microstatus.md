# Microstatus prototype implementation plan

This plan is for the agent building Willie's local prototype. Finish by opening
the real homepage and status route, checking both themes and narrow layouts,
and committing the owned changes on the dedicated branch.

**Goal:** Add a quiet footer status that opens a responsive `/status` page.

**Architecture:** One client provider owns the clock and weather snapshot for
the footer and page. A same-origin endpoint fetches city-level Open-Meteo data.
The status page also reads published writing from the site's content loader.

**Tech stack:** Next.js 16.3, React 19, existing Material tokens, Node tests,
and Playwright.

## Tasks

- [x] Test weather parsing, invalid responses, and stale data with
      `pnpm exec tsx --test tests/unit/status.test.mts` before implementation.
- [x] Add `lib/status/model.ts` for public city configuration and validation.
      Use Las Vegas city-center coordinates and America/Los_Angeles as the
      explicitly documented prototype defaults. Do not read device location.
- [x] Add `app/api/status/route.ts` with a 3-second fetch deadline and a
      15-minute server cache. Fail independently of page rendering.
- [x] Add `components/status/StatusProvider.tsx`, `Microstatus.tsx`,
      `LocalConditions.tsx`, and `status.css`. Share one browser request and
      minute-resolution clock. Omit weather older than 60 minutes.
- [x] Add the provider to `app/layout.tsx`. Add the quiet footer link beneath
      the existing tagline. Preserve the collapsed contact row and mark the new
      link inert while the footer hides it.
- [x] Add `app/status/page.tsx` with existing TopBar, metadata helper, live
      conditions, homepage venture links, and up to two published writings.
      Omit unconnected music and private sources.
- [x] Register `/status` in `lib/site.ts`. Avoid a duplicate footer nav link
      because the microstatus already opens it.
- [x] Document source freshness and extension rules in `docs/status.md`.
- [x] Verify formatting, unit tests, lint, typecheck, and build. Limit worker
      concurrency to two. Inspect real screenshots at 390px, 768px, and 1440px
      in both themes, plus overflow at 320px and dock keyboard focus.
- [x] Open the local prototype in Codex and commit with scope `pages`.

## Design decision

The footer uses a quiet line, not another card. It adds city, local time,
temperature, and one weather icon without enlarging the contact dock. The
status page can give conditions more space while retaining the site's own
type, colors, navigation, and footer. Fetching cannot block either surface.
No automatic availability or private activity is inferred.
