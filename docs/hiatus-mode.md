# Hiatus Mode

`SITE_MODE=hiatus` publishes the temporary Project Superbloom landing page at
`/` while preventing visitors from reading normal site content. The site is
live when `SITE_MODE` is unset, so hiatus is opt-in.

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
- `/pagefind` and `/search-index.json`, the search index files

`/initiatives` and its pages stay reachable in hiatus on purpose: they are
launch content, and `tour.willie.page` and `diaries.willie.page` redirect to
them. `/search` stays reachable too, but it returns no results while the site
is in hiatus, because the pages it would list are blocked.

Blocked content routes rewrite to the app not-found page with a `404` status.
Operational routes and framework assets stay accessible, including `/_not-found`,
`/500`, `/robots.txt`, `/sitemap.xml`, `/_next/*`, and `/_vercel/*`.

Unset `SITE_MODE`, or set it to `live`, to remove the hiatus gate and serve
the full site again.
