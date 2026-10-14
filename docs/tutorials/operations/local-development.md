# Run the site locally from a fresh checkout

Set up a new checkout, run the repository checks, and browse the site locally.
By the end, you will have seen both the development server and the checks used
to prepare changes. The exercise uses local-only bootstrap so learning the site
does not require provisioning a publishing deployment.

## Prerequisites

You need Git with SSH access to `WillieCubed/website`, Node.js 24 or later,
and pnpm. The exact pnpm version is pinned in `package.json`; bootstrap checks
it before installing. You also need network access to GitHub and the package
registry, a terminal, a browser, and an unused parent directory for the checkout.

These instructions have been inspected against the bootstrap scripts. A complete
fresh-machine run has not been exercised for this documentation revision. The
[bootstrap reference](../../reference/operations/bootstrap.md) explains phases
and provider setup when you need them later.

## 1. Create the checkout

In your chosen parent directory, run:

```sh
git clone git@github.com:WillieCubed/website.git
cd website
```

Check that this directory contains `package.json`, `pnpm-lock.yaml`, and `app/`.
All remaining commands run here, at the repository root. The lockfile records
the dependency tree the site expects; keep it intact during setup.

If cloning fails, check that the GitHub account associated with your SSH key can
read the repository. Resolve that access before continuing. If `website` already
exists, use the existing checkout or choose another parent rather than cloning
over work.

## 2. Bootstrap local development

### Install and check the locked workspace

```sh
pnpm bootstrap --local-only
```

Expect successful Node and pnpm checks, installation from the lockfile, a passing
`pnpm check`, and creation of `.env.local` from `.env.example` when absent.
An existing `.env.local` is preserved. Leave the example environment values empty
for this exercise: ordinary content can run without the hosted publishing setup.

Local-only mode stops before provider authentication and deployment. The workspace
check includes tests, lint, type checking, and a production build; it disables
outgoing publishing notifications for that check. This gives you a baseline for
source work without making setup depend on external publishing credentials.

### Resolve a failed baseline before editing

Stop at the first reported failure. For a version mismatch, use the version
pinned in `package.json` and rerun bootstrap without modifying the lockfile.
For an installation or check failure, inspect the command's error before moving
on. Starting edits on a failed baseline makes it harder to distinguish a setup
problem from a regression you introduced.

## 3. Open the local site

### Start the server and use its printed URL

```sh
pnpm dev
```

Wait for the ready message, then open the printed URL. A regular checkout uses
`https://williecubed.localhost:1355`; worktrees have a branch-prefixed hostname.
Use the actual output so you do not accidentally inspect a server from another
checkout.

### Browse the content you came to work on

Confirm the homepage renders, follow a link to Writings, and open Search.
You should see ordinary public content. Optional database-backed features can
be unavailable with empty environment values; that is a separate boundary from
whether a writing page renders.

If the server cannot start, inspect its terminal error. If a browser page looks
wrong, first confirm its origin matches the URL the current process printed.
Keep the terminal running while you browse; Ctrl+C stops that development server.

## 4. Verify and finish

Stop the server with Ctrl+C and run:

```sh
pnpm preflight --local-only --phase env
```

Expect the environment check to find `.env.local`. Selecting `env` checks the
file created during setup without repeating the full tests and build after a
browsing-only exercise. If you changed source while experimenting, use
`pnpm preflight --local-only` to repeat the full local checks. Neither form
certifies hosted publishing.

Keep the checkout for development and continue with
[your first writing page](../content/first-writing.md). `.env.local` and build
output are ignored; do not commit environment values. If the exercise was
disposable, confirm the checkout contains no work you need before removing only
that checkout. Do not remove a shared working directory as tutorial cleanup.
