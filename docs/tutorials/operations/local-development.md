# Run the site locally from a fresh checkout

Create a checkout, install its locked dependencies, and browse the site locally.
You will finish with a local URL where you can inspect the homepage, writings,
and search. This exercise leaves the database and publishing credentials empty;
it does not provision or deploy a Cloudflare Worker.

## Prerequisites

You need Git with SSH access to `WillieCubed/website`, Node.js 24 or later,
and pnpm 11.5.1, the version currently pinned in `package.json`. You also need
network access to GitHub, the package registry, and Playwright browser downloads,
a terminal, a browser, and
an unused parent directory for the checkout. Installing dependencies uses local
disk space and downloads packages; this exercise creates no provider resources.

The instructions were checked against `package.json`, `.env.example`, and
`portless.json`. A complete fresh-machine run has not been exercised for this
documentation revision. The
[setup reference](../../reference/operations/bootstrap.md) describes account
and resource preparation when you later need a hosted deployment.

## 1. Create the checkout

In your chosen parent directory, run:

```sh
git clone git@github.com:WillieCubed/website.git
cd website
```

Check that the directory contains `package.json`, `pnpm-lock.yaml`, and `app/`.
All remaining commands run here, at the repository root. The lockfile records
the dependency tree the site expects; keep it intact during setup.

If cloning fails, check that the GitHub account associated with your SSH key
can read the repository. Resolve that access before continuing. If `website`
already exists, use another parent directory for this fresh-checkout exercise
rather than cloning over work.

## 2. Prepare the local workspace

### Install the locked dependencies

Check the local tools, then install:

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
```

The Node version must satisfy `engines.node` in `package.json`, currently
`>=24`; pnpm should match its `packageManager` version, currently 11.5.1.
The frozen install must finish without changing `pnpm-lock.yaml`. If a version
or installation check fails, resolve that error before editing source. A clean
baseline will help you distinguish a later regression from a setup problem.

### Create the environment file

```sh
test -f .env.local || cp .env.example .env.local
```

This copies the example only when `.env.local` is absent, preserving any file
that already exists. For this exercise, leave the database and publishing
values empty. `.env.example` documents the optional features each value enables;
you do not need a Neon connection or signed Cloudflare Access request to browse
ordinary content. Never commit real environment values.

### Install the test browser

The unit suite includes headless Chromium fixtures. Install the browser version
pinned by the locked Playwright package before running the checks:

```sh
pnpm exec playwright install chromium
```

This downloads a browser into the local Playwright cache. On Linux, install its
system libraries with `pnpm exec playwright install --with-deps chromium`.
That command can require administrator access for operating-system packages.
Resolve a missing browser or library before continuing; an ordinary installed
Chrome does not replace Playwright's pinned Chromium.

### Run the repository checks

```sh
pnpm check
```

Expect documentation checks, tests, lint, type checking, and the Next production
build to pass. The
package scripts share `pnpm content:prepare` for the Studio browser runtime,
compiled MDX, search index, and Worker content manifest. That command reuses
artifacts only when source/configuration fingerprints and output bytes match. These checks build local output;
they do not upload a Worker or prove a hosted deployment.

Stop at the first failure and inspect its command output. Keep the lockfile
intact while resolving the problem, then rerun the failed check or `pnpm check`
as appropriate. The removed `bootstrap` and `preflight` commands are not part
of the current package scripts.

## 3. Open the local site

### Start the server and use its printed URL

```sh
pnpm dev
```

Wait for the ready message, then open the printed URL. The command starts the
app through portless, which gives a regular checkout the named address
`https://williecubed.localhost:1355`. Worktrees use a branch-prefixed hostname.
Follow the actual output so you inspect this checkout's server rather than
another running copy.

### Check the local reading experience

Confirm that the homepage renders, follow a link to Writings, and open Search.
You should be able to read content and navigate between pages. Account,
database, and publishing features can remain unavailable because their
connections and credentials are unconfigured; this exercise does not test
them.

If the server cannot start, inspect the terminal error. If a browser page looks
wrong, first compare its origin with the URL the current process printed.
Keep that terminal running while you browse. Ctrl+C stops the development
server.

## 4. Verify and finish

Stop the server with Ctrl+C. Confirm that the local environment file exists
and inspect any working-tree changes:

```sh
test -f .env.local
git status --short
```

The file check exits successfully without output when `.env.local` exists.
The environment file and ordinary build caches are ignored. Generated files
may appear in the working tree; inspect their paths before deciding whether
they belong to an intentional change. Preserve unrelated work.

A browsing-only exercise does not need another full build. If you changed
source while experimenting, run `pnpm check` again before treating the checkout
as a passing baseline. Keep the checkout and continue with
[your first writing page](../content/first-writing.md), or remove it after
confirming it contains no work you need. Remove only that disposable checkout;
keep any checkout with ongoing work.
