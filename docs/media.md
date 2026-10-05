# Media mentions

This page is for the maintainer adding coverage to `/media`. Add a verified
entry to `lib/media.ts` and check the page at desktop and phone widths.

Each entry records the publisher's headline, publication name, direct source
URL, and calendar date. For example, FOX5 Vegas published its Week Without
Driving story on September 30, 2026 despite October 1 appearing in its URL.
An appearance can be a quotation, an interview, or a photo caption. The page
does not assign role labels.

An optional `excerpt` contains an exact short quotation. An optional
`related` link points to the work discussed when there is a useful destination.
Both can be omitted. Excerpts start collapsed and work without JavaScript.

An optional `image` supplies a real local photograph and its alt text. The
approved FOX5 card uses the site's existing bus photograph as its illustration;
it is not the publisher's thumbnail. Entries with images appear first within
their year. The other entries follow in date order. Entries without images
use compact rows with no reserved thumbnail area or fabricated masthead.

The page starts with five verified mentions, including a UT Dallas News Center
photo appearance from August 20, 2019. It does not claim to be an exhaustive
archive. Add older or newly discovered coverage when its source is verified.

The `/media` entry in `lib/site.ts` supplies its metadata and adds it to the
footer, breadcrumbs, command palette, hover cards, search, and sitemap.
