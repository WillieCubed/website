# Parked pages

Next.js never routes a folder whose name starts with an underscore, so
every page in here returns a 404. These are the pages from the old site
that have not been rebuilt in the new design yet. Landing, writings,
initiatives, and brand are the only routed pages.

To bring a page back, rebuild it, move its folder to `app/<route>`, and
set its `routed` flag to true in `sitePages` in `lib/site.ts`. The footer
links, the sitemap, the hover-card registry, and the 404 page's "being
rebuilt" note all read that list.

A page that passes an image to `pageMetadata()` must pass a 1200×630
card, because the helper declares every custom social image as
1200×630. The parked About and Contact pages pass
`/assets/headshot.jpg`, which is 1157×1157, so fix the image or add an
image-size option to `pageMetadata` when they are routed again.

Projects also left the site feeds and search. When the project pages come
back, restore the project items in the three site feeds under
`app/feed.xml` and `app/feed/`, remove the project exclusions in
`selectSearchable` (`lib/search/server.ts`), `SearchContentType`
(`lib/search/types.ts`), and `app/api/search/route.ts`, and have
`lib/search/collect.ts` emit project items.

`layout.tsx` here is the old layout for these pages, which adds the top
bar. It only applies while the pages sit in this folder.
