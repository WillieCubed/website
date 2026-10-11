# Parked pages

Next.js never routes a folder whose name starts with an underscore, so
the files here do not create routes. These are retained source pages from
the old site. Landing, writings, initiatives, projects, media, and brand have public
replacements outside this folder. About and Research are not public. Their
unapproved replacements are retained in `app/_proposals`, which Next.js
excludes from routing. The old research detail pages remain unrouted.

To bring a page back, rebuild it, move its folder to `app/<route>`, and
get explicit content and publication approval, then set its `routed` flag
to true in `sitePages` in `lib/site.ts`. The footer
links, the sitemap, the hover-card registry, and the 404 page's "being
rebuilt" note all read that list.

A page that passes an image to `pageMetadata()` must pass a 1200×630
card, because the helper declares every custom social image as
1200×630. The old About and Contact sources pass `/assets/headshot.jpg`, which is
1157×1157. The unapproved About proposal uses the shared social card. Fix
Contact's image before restoring that source.

The project index and detail routes live at `app/projects`. Public project
files also enter search, hover cards, the sitemap, and the three site feeds.
Every discovery path excludes drafts and hidden projects, including in
development. See [the projects guide](../../docs/projects.md).

`layout.tsx` here is the old layout for these pages, which adds the top
bar. It only applies while the pages sit in this folder.
