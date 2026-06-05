# Hiatus Mode

`SITE_MODE=hiatus` publishes the temporary Project Superbloom landing page at
`/` while preventing visitors from reading normal site content.

Hiatus mode blocks content routes only:

- `/about`
- `/apps`
- `/bio`
- `/colophon`
- `/contact`
- `/design`
- `/hi`
- `/media`
- `/now`
- `/projects`
- `/random`
- `/research`
- `/writings`

Blocked content routes rewrite to the app not-found page with a `404` status.
Operational routes and framework assets stay accessible, including `/_not-found`,
`/500`, `/robots.txt`, `/sitemap.xml`, `/_next/*`, and `/_vercel/*`.

Set `SITE_MODE=live` to remove the hiatus gate and serve the full site again.
