# Loading and continuity

Loading protects the visitor's task. Show available content immediately, then enhance it in place. Loading must never manufacture a delay, erase an edit, obscure ready content, replace a usable page with a spinner, or make a working native destination depend on JavaScript.

## Content before indicators

Music is a public showcase of Willie’s taste and listening history. Introductions, collection labels, loading messages, recovery destinations, and metadata address visitors accordingly. Instructions about editing your collection belong only in private curation.

Public pages deliver their primary content, requested query, meaningful values, and native destinations in visible server HTML. An interactive Suspense fallback cannot duplicate a form or replace a page's composition. Search results belong to their query, and writings and responses retain their microformat ownership in raw HTML.

Serve approved data only. Failure never relaxes Music's approval, eligibility, or freshness checks. Optional providers have a bounded enrichment budget; an unavailable provider cannot prevent a writing from being read. Network and response body waits are bounded. Optional client requests use a ten-second deadline; optional writing enrichment has a 1.5-second budget, and public Music has a three-second budget with a source destination on failure.

## One composition across states

Pending, ready, empty, and failed states use the same page navigation, heading, column widths, gutters, and controls. Keep the shell mounted; replace only unknown data. Music curation uses its actual gallery composition during the initial request. Studio's document and library retain their navigation and canvas or list region.

Placeholders use the same media ratios, card slots, text metrics, and responsive breakpoints as the loaded region. Unknown content must not be represented by invented titles, counts, or percentages. Expose one useful status, hide decorative skeletons from assistive technology, and disable actions that need unavailable data. A failure is terminal rather than permanently busy and supplies a usable retry or destination.

Evaluate the composition before matching its geometry. Repeated headings, competing rows of pills, empty status rows, and oversized secondary controls can make a perfectly stable page difficult to use. Put status in the same metadata slot as the loaded count. Make unavailable controls visibly disabled as well as semantically disabled. Distinguish collection navigation, filtering, and creation actions.

Gallery and curation cards share a caption structure: the title spans the available caption width, and the opening arrow sits beside the track count in a separate metadata row. Allow up to four title lines. Public cards size to their actual titles, with the track count directly below; do not reserve unused title lines on every loaded card. Keep known cards visible with identical markup while other data loads. Unknown gallery placeholders use the same artwork, insets, caption structure, and four-line maximum; curation retains its fixed title and control slots. Wrap long titles before truncating them, keep card heights bounded, and expose the full title in the opened playlist. Check the longest real titles at phone and desktop widths; an arrow must never reduce their title area.

Public gallery cards group artwork, title, count, and opening affordance on one tonal surface. Use restrained corners: 20px on the container and 12px on the artwork. Artwork fills the card inside an equal 12px inset rather than an independently centered width cap. Cards in a multi-column row share the tallest card’s height; titles and metadata remain together at the top, with any spare room below the metadata. The opening link fills the container’s interior. The grid uses one column on narrow phones so cards retain their natural height and the container inset does not squeeze long titles. Hover, press, and keyboard focus act on the whole container. Reduced motion preserves color and focus feedback without lifting or scaling the card.

Use the row beneath curation artwork for inclusion, alongside the caption’s metadata and ordering controls. Reserve each control’s actual space so targets cannot overlap. When the card is too narrow, wrap ordering onto a second row rather than narrowing the title. Pending cards reserve the same rows as the default loaded view; entering reordering can intentionally add its control row on narrow cards.

Curation cards put identity and the opening destination ahead of inclusion and ordering. Show one collection context and count, with series choices in a collection menu and inclusion filters without repeated counts. Reordering is an explicit mode; hide ordering controls while browsing and leave it when changing inclusion filters. Use the available phone width; do not squeeze editing controls into a public gallery's narrow artwork columns. Omit ordering controls when no ordering action is available. Publication summaries pin to the bottom on compact screens and form a contained floating panel on larger screens. Bound the surface to the Music workspace: its in-flow seat comes before the footer, and it scrolls away as the footer enters. Preserve one mounted surface while its width, inset, padding, and shape transition. Reserve its measured height in scroll padding, including safe-area insets and the full vertical travel of its transition, so the final playlist and controls stay reachable even during a resize. Never add a publication-bar spacer after the footer. Position transient feedback above the pinned surface's reserved area. Reduced motion switches geometry immediately.

Refreshes preserve previously available content and user input. Reject stale responses, associate search results with their producing query, and never let Enter activate a result from an earlier query. Keep focus, selection, scroll position, open context, and browser history through asynchronous updates.

## Geometry and motion

Aim for zero unexpected layout shift attributable to loading. A page-level CLS below 0.1 is an outer performance threshold, not permission to move individual targets. Compare full viewport pending and ready states and track target displacement separately from intentional transforms.

Reserve action widths for their longest normal, busy, confirmed, and retry labels, including icons and account options. Known image dimensions preserve their actual ratio. Unknown media uses a bounded presentation slot with contained content; its slot ratio is not fabricated source metadata. Keep media source links outside embeds, available before playback and after failure.

Classic scrollbar gutters reserve matching space at both inline edges at every
viewport width. Overlay scrollbars reserve no extra rails. A scrolling region and its header and action row mirror the same gutters, so their content keeps one start and end alignment whether a scrollbar is visible or not. Measure the available content width when positioning or scaling shared chrome. Fullscreen dialogs use the available container width; `100vw` includes reserved scrollbar space and can push one edge beyond that container.

MD3 Expressive motion communicates a change or acknowledges an action. Reuse the site's motion tokens and shared indeterminate indicator; its 24px wavy circular form stays legible at at least 3:1 contrast, including inside disabled controls. Do not claim determinate progress without a real denominator. Reduced motion applies immediately and leaves a static, meaningful state. Content is usable as soon as it is ready; outgoing placeholders may fade independently. Decorative repeating motion stops within five seconds or provides a pause control.

Navigation retains the current useful page and acknowledges an unresolved enhanced link after 200ms without adding an inline layout box. Fast navigation introduces no spinner flash. Hydration must preserve the footer already visible to the visitor while retaining its intentional docking motion on normal visits.

## Progressive enhancement and recovery

Links have real destinations, forms have native actions and methods, countdowns show current values, and unavailable enhancements do not advertise enabled inert controls. The social action slot initially offers an RSS or share destination. Native status editing and native search remain usable without scripts. Private editing tools explain their JavaScript requirement and retain a readable destination.

Use busy semantics on the operation actually running and polite status for meaningful progress and outcomes. Announce completion and failure without announcing each keystroke or decorative frame. Keep callback failures visible even if the optional service becomes unavailable. Friendly recovery copy identifies what the visitor can do, without exposing import paths or provider internals.

## Acceptance checks

Check cold and warm direct loads, native submissions without scripts, held responses, failed imports, offline requests, stalled response bodies, stale queries, retries, undo, interrupted navigation, and unmounts. Check both color schemes, phone and desktop geometry, keyboard focus, browser history, live reduced-motion changes, and assistive status semantics. Capture uncropped full viewport pending and ready states; measure unexpected shifts and target movement. Browser fixtures prove interface behavior, not live account-provider writes or publication.

## References

- [Material 3 progress indicators](https://m3.material.io/components/progress-indicators/overview) and [guidelines](https://m3.material.io/components/progress-indicators/guidelines).
- [Material 3 motion](https://m3.material.io/styles/motion/overview).
- [WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) and [pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).
- [Cumulative Layout Shift](https://web.dev/articles/cls).
