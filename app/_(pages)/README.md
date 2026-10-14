# Parked pages

Next.js never routes a folder whose name starts with an underscore, so the files
here do not create routes. These are retained source pages from the old site.
Landing, writings, initiatives, projects, media, and brand have public
replacements outside this folder. About and Research are not public. Their
unapproved replacements are retained in `app/_proposals`, which Next.js excludes
from routing. The old research detail pages remain unrouted.

The project index and detail routes live at `app/projects`. Public project files
also enter search, hover cards, the sitemap, and the three site feeds. Every
discovery path excludes drafts and hidden projects, including in development.
See [the projects guide](../../docs/reference/content/projects.md).

Before restoring a page, rebuild and review its retained source, then obtain
explicit content and publication approval. After approval, move its folder to
`app/<route>`. Add or update its record in `sitePages` in `lib/site/navigation.ts`, with
`routed: true`; About and Research currently have no entries to toggle. That
shared list supplies footer links, sitemap entries, hover cards, and the 404
page's “being rebuilt” note. Review those discovery surfaces with the page so
restoration makes its availability clear throughout the site.

A page that passes an image to `pageMetadata()` must pass a 1200×630 card,
because the helper declares every custom social image as 1200×630. The old About
and Contact sources pass `/assets/headshot.jpg`, which is 1157×1157. The
unapproved About proposal uses the shared social card. Fix Contact's image
before restoring that source.

`layout.tsx` is the retained layout that added the old top bar. Do not move it
with a restored page without reviewing how it fits the current shared layout;
restoring the content should not duplicate the site's chrome.
