# Build metrics

The CI metrics summary tracks Cloudflare build output and browser loading in a
local preview. These values help compare revisions; they are informational and
do not represent production visitor analytics or enforce budgets.

## Build metrics

| Metric               | Meaning                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build time           | Elapsed time for `pnpm build:cloudflare`, in seconds. It excludes the later Wrangler bundle check.                                                                            |
| Worker JavaScript    | Byte size of Wrangler's dry-run bundled `worker.js`, shown in MiB. This is an output-file size, not a transfer-size estimate.                                                 |
| Static assets        | Total byte size and file count for files under `.open-next/assets`, shown in MiB and files. The bytes are uncompressed output-file sizes.                                     |
| Tracked source lines | Lines in tracked first-party `.ts`, `.tsx`, and `.css` files under `app/`, `components/`, and `lib/`. Generated files, tests, dependencies, and untracked files are excluded. |

## Browser metrics

CI runs five samples per route in headless Chromium against the local Cloudflare
preview and reports the median. Times are milliseconds; `n/a` means the browser
did not provide that measurement.

| Metric | Meaning                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| TTFB   | Time from the navigation request starting until its first response byte, measured with the browser Navigation Timing API. |
| FCP    | Time from navigation start until the browser first renders content from the page.                                         |
| LCP    | Time from navigation start until the largest content element observed in the page is rendered.                            |
| CLS    | Cumulative layout shift score: the largest session window of layout shifts that did not follow recent user input.         |

These browser measurements describe a local lab run, not real-user performance.
In particular, TTFB is measured against the loopback preview, so it excludes
production network and edge conditions.

The local collector requests `http://localhost:8787` while Wrangler binds to
IPv4 loopback. OpenNext recognizes that hostname and sets dynamic HTML responses
to `Content-Encoding: identity` to use its
[Miniflare streaming workaround](https://github.com/cloudflare/workers-sdk/issues/8004). Linux requests to `127.0.0.1` can return HTTP 200 with an empty compressed
body instead. This uses the adapter's existing local workaround; it does not
change production compression. Static JavaScript, CSS, and other assets retain
the encoding their server sends. The transfer ledger records those actual
encoded bytes, including compressed assets, rather than estimating compression.

Compare baseline and candidate with the same collector, hostname, and transport.
Local identity HTML totals do not establish production compressed-HTML savings.
`PREVIEW_METRICS_BASE_URL` and private target URLs remain exactly as supplied;
the collector does not rewrite their hostnames or encoding headers.

## Measurement outcomes and repeat visits

The collector measures `/`, `/search`, `/writings`, `/initiatives`, `/projects`,
and `/music`. It discovers a visible published initiative-detail link from
`/initiatives` and measures that destination too. Set
`PREVIEW_METRICS_INITIATIVE_PATH` to choose a same-origin initiative detail
explicitly. Each of the five rounds
starts in a fresh browser context and then revisits the same route in that
context. The route's existing top-level timing fields and `samples` describe
cold visits. `warm` describes revisits with the browser cache retained. The
collector does not disable the browser cache or intercept requests.

Each sample reports `valid`, `failed`, or `unavailable`. A visible document
that supports paint entries but never reports FCP or LCP fails measurement.
Hidden documents and unsupported required entry types are unavailable. CLS
is unavailable when the browser lacks layout-shift observation; that case does
not count as a measured zero. The collector records supported entry types,
visibility, sample outcomes, expected/attempted/valid/failed/unavailable/missing
counts, and the number of valid values behind each median. Medians include
only valid samples. A missing sample never becomes a successful zero.

The JSON also contains five runs of each navigation journey. These journeys
follow existing site links from Search to Writings, Initiatives to the selected
initiative detail, Writings to Projects, and Projects to Music. Each run retains the browser cache
and the router state between steps. `navigationMs` ends when the destination URL
and document load state are ready. `elapsedMs` includes the later observation
window. Neither value claims to measure the visual completion of a client
navigation. Standard FCP and LCP describe document loads, so the collector does
not relabel them as client-navigation paints.

If no visible published initiative detail exists, `initiativeTarget` records
unavailable, `routes["initiative-detail"]` records an unmeasured unavailable
result, and its journey has no runs. Their default counts retain expected 5,
attempted 0, and missing 5. The report status becomes `partial`; absence is not
converted into a successful measurement or a request for an unpublished page.
A malformed override or failed initiative discovery is a measurement failure.

The command writes its report before returning failure when an attempted public
sample or journey fails or is unavailable. The explicit missing-initiative case
above remains partial without failing the command. Metrics remain informational,
but a broken measurement does not pass as a successful one. Startup failures
still return errors directly.

## Browser transfer bytes

Every cold visit, warm revisit, and journey step records encoded bytes from
Chromium's response-header and data-chunk protocol events. A later
`Network.loadingFinished.encodedDataLength` total replaces the incremental
count for that request. These are encoded transfer bytes, including
protocol-reported response overhead. They are not decoded resource sizes,
Worker bundle sizes, or compression estimates. Cache-hit events suppress
original response-size metadata so cached resources can record zero transfer.

`transfer.bytes` includes bytes observed during the recorded window, including
partial responses that remain open. `byCategory` splits ordinary
traffic into HTML, React Server Component payloads (`text/x-component`),
JavaScript, CSS, images, JSON, and other files. `prefetch.bytes` and
`prefetch.byCategory` separately account for requests marked by `Purpose`,
`Sec-Purpose`, or `Next-Router-Prefetch` headers. The ordinary category totals
exclude those prefetch bytes. Request totals retain completed, failed, and
still-pending requests so an interrupted download does not look like a cached
zero-byte success. Redirect hops retain their own transfer bytes.

## Explicit targets and private routes

Set `PREVIEW_METRICS_BASE_URL` to measure an already-running public target.
Without it, the command starts and stops its own local Cloudflare preview.
The report describes that target's local lab conditions; it does not establish
production performance.

Private routes require `PREVIEW_METRICS_PRIVATE_BASE_URL`. Use an isolated
Studio fixture server or another explicitly selected authenticated target.
Supply `PREVIEW_METRICS_PRIVATE_STORAGE_STATE` with a Playwright storage-state
file or `PREVIEW_METRICS_PRIVATE_HEADERS` with JSON request headers when the
target needs them. The collector probes `/api/studio/documents` before measuring
`/studio`, `/studio/music`, and an optional same-origin detail selected by
`PREVIEW_METRICS_INITIATIVE_PATH`. Header injection applies only to the selected
origin, including redirect hops. Storage-state cookies keep the browser's native
scope. CDP request interception preserves HTTP caching; Playwright routing would
disable it. A missing target or a rejected authentication/data
probe produces explicit unavailable private-route samples. The collector never
counts an unauthenticated page shell as successful private measurement.
Probe failures retain the requested paths and sample count. Network errors use
a fixed diagnostic because raw request exceptions can contain credentials.

Private outcomes live under `privateRoutes`. They remain separate from public
CI status because the default public preview has no private fixture or owner
credentials. Configure and inspect the private run before claiming private
performance coverage. Do not commit storage-state files or authentication
headers.

Set `PREVIEW_METRICS_PRIVATE_ONLY=1` for an authenticated fixture-only run. The
report uses `scope: private`, leaves public routes and journeys empty, and
measures those private routes and any configured initiative. The isolated Studio metrics harness
selects this scope automatically. It provides no public performance coverage;
run public production metrics separately.

Each navigation, paint-observer wait, and transfer-observation phase has a
30 second default deadline. A phase waits for network-byte quiet and responses
to all requests. Known RSC streams and ignored HTTP error responses may remain
open after quiet. Their received bytes, pending request details, and unfinished
state remain in the report. Continuing byte traffic, unanswered requests, and
other incomplete response types time out and fail the sample or journey.

Each transfer snapshot records its observation window and quiet/timeout result.
The collector retains open requests at a phase checkpoint and starts the next
phase's byte count at their previous offset. Later chunks and terminal totals
therefore count once, even when a cold request finishes during a warm revisit
or journey step. The inherited request retains its category and prefetch flag.
Request totals include retained open records; `inherited` identifies requests
that started in an earlier phase. A pending count describes open responses; it does not imply a missing paint.

Browser instrumentation observes network events and performance entries. It
does not replace Fetch, clone responses, consume ignored response bodies, or
change RSC backpressure. These measurements describe bytes the visitor's
browser received during the stated windows, rather than bytes obtained by
forcing every response to finish.

The responsive content image path uses prepared content-hashed originals for
immutable optimizer responses. Compare warm image bytes as well as cold
transfer savings. The
[performance guide](../../guides/operations/performance.md#images-video-and-byte-delivery)
owns this cache policy. A smaller cold image total does not excuse a larger warm
retransfer or an image that never decoded.

## CI review evidence

Set `PREVIEW_METRICS_SCREENSHOTS=1` to capture routes after every cold,
warm, private, and journey measurement has finished. Public runs capture public
routes. Private-only runs capture `/studio`, `/studio/music`, and an optional
same-origin initiative detail selected by `PREVIEW_METRICS_INITIATIVE_PATH` from
`PREVIEW_METRICS_PRIVATE_BASE_URL` with the same JSON request headers and
storage-state file configured for private measurements. The collector reuses its
browser and server, but screenshots use fresh contexts. Capture requests never
contribute to the previously recorded bandwidth or timing samples.

Each route receives uncropped 1440×1000 and 390×844 viewport captures in light
and dark themes. The capture waits for fonts and in-viewport images to decode.
A local image decode error or a 30 second decode deadline fails that capture.
The bound changes only the later screenshot wait; the measured
transfer and paint windows remain unchanged. Decode errors identify the source
URL and image transform parameters.
The manifest records failures; a blank image is not accepted as settled visual
evidence. Screenshots use reduced motion and disable screenshot animations.
Private-only runs do not capture public screenshots. Authentication headers,
storage-state contents, and the storage-state filename never enter the
screenshot manifest or metrics screenshot summary.

The metrics CI job enables this option. Reviewers can download the
`cloudflare-build-metrics` JSON artifact and the
`cloudflare-preview-screenshots` artifact from the linked Actions run. CI retains
both for 14 days and uploads available evidence after a failed measurement.
CI uploads the candidate evidence before starting the baseline comparison, so
a failed or interrupted baseline does not discard the candidate report.
The private fixture job enables the same capture option and uploads its
`private-studio-music-screenshots` artifact for 14 days. The screenshot artifacts
contain PNG files and their manifests. Generated evidence
stays outside Git.

The job summary reports measurement status, sample counts, cold and warm timing
medians, navigation journeys, observed transfer bytes by type, separate prefetch
bytes, and pending or unanswered responses. Missing values remain `n/a`. The
summary marks a purportedly valid sample group with missing required timings
as incomplete instead of presenting it as successful.

For pull requests, CI also checks out the event's base SHA into an isolated Git
checkout, installs its frozen dependencies, and builds that revision. After the
current preview closes, CI runs the current collector from the baseline working
directory. Both runs use the same browser, observation rules, screenshot sizes,
and runner. The baseline's own Git checkout supplies its revision identity.
Baseline JSON and screenshots upload in separate baseline artifacts.

The summary compares cold, warm, and journey transfer medians by category.
Prefetch bytes stay separate. Deltas are exact current-minus-baseline byte
values, not Worker output-size estimates. Failed, missing, incomplete, unanswered,
or broken core-resource windows do not produce savings claims. Timing medians
remain informational, and CI does not enforce timing budgets.
