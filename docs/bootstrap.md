# Bootstrap and preflight

This reference is for Willie or an agent setting up a fresh checkout. Run
`pnpm bootstrap --local-only` to get a working local app. Run `pnpm bootstrap`
when you also need to check a linked Vercel project. Afterward, run `pnpm dev`.

The command uses the same `bootstrap` and `preflight` entry points as the LVBT
website and TransitMapper projects. The phases are idempotent, so a second run
rechecks current state instead of trusting a saved status file. `pnpm preflight`
reports gaps without installing packages or writing `.env.local`.

| Phase        | Bootstrap                                                                               | Preflight                               |
| ------------ | --------------------------------------------------------------------------------------- | --------------------------------------- |
| `tools`      | Checks Node 24 and the pinned pnpm version.                                             | Same check.                             |
| `workspace`  | Runs `pnpm install --frozen-lockfile` and `pnpm check` without postbuild notifications. | Checks that dependencies are installed. |
| `env`        | Copies `.env.example` to `.env.local` only if absent.                                   | Reports whether `.env.local` exists.    |
| `auth`       | Checks GitHub and Vercel CLI sign-in.                                                   | Same read-only check.                   |
| `deployment` | Checks the linked project, Vercel variable names, and GitHub notification secret names. | Same read-only check.                   |

Use `--phase env` to repeat one phase, `--local-only` to skip remote phases, or
`--project website|indieweb-acceptance` to require a specific Vercel link. The
default is the project in `.vercel/project.json`. Bootstrap stops if the link
points to any other project. Link the intended project with `vercel link` and
rerun. The domain cutover script separately refuses any project except
`website` before it changes production domains.

The deployment phase checks configuration names, not secret values or live
database state. It requires Postgres, Webmention, IndieAuth, Micropub, and
photo storage settings. Apply the SQL files under `lib/db/migrations` in
numeric order when provisioning a new database. The acceptance project also
needs `NEXT_PUBLIC_SITE_ORIGIN` so its generated
permalinks and feeds stay on the acceptance host. `INDIEWEB_NOTIFY_SECRET_PRODUCTION`
remains pending until Willie approves public posts. Bootstrap reports that
state without setting the secret or sending notifications. The
[production rollout record](indieweb/production-rollout.md) tracks that gate.

For a new authenticator enrollment, run `pnpm indieauth:totp` in a private
terminal, scan the URI with an authenticator, and set its printed secret as
`INDIEAUTH_TOTP_SECRET` in the intended Vercel project. Do not commit or save
the URI or QR image. This step is already complete for the current production
deployment; the local enrollment copies were deleted on September 23, 2026.
