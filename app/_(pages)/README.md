# Parked pages

Next.js never routes a folder whose name starts with an underscore, so
every page in here returns a 404. These are the pages from the old site
that have not been rebuilt in the new design yet. Landing, writings, and
initiatives are the only routed pages.

To bring a page back, rebuild it and move its folder to `app/<route>`.
Then add it back in the places that skip parked pages on purpose:

- the page links in `components/site/SiteFooter.tsx`
- the page list in `app/sitemap.ts`
- the static page cards in `lib/entities/registry.ts`, so links to it get
  a hover card

Projects also left the site feeds and search. When the project pages come
back, restore the project items in the three site feeds under
`app/feed.xml` and `app/feed/`, and remove the writing-only filter in
`searchContent` in `lib/search/server.ts`.

`layout.tsx` here is the old layout for these pages, which adds the top
bar. It only applies while the pages sit in this folder.
