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
