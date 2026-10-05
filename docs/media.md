# Media mentions

This page is for the maintainer adding coverage to `/media`. Create a Markdown
file in `content/media/` and check the page at desktop and phone widths.
The filename supplies the entry's stable ID. Keep editorial content in these
files; `lib/media.ts` only loads and validates them.

For example, `content/media/las-vegas-sun-da-vinci.md` contains:

```yaml
---
title: Students Visit "Da Vinci-The Genius"
publication: Las Vegas Sun
url: https://lasvegassun.com/photos/2012/oct/01/451168/
published: '2012-10-01'
---
```

Store every field in frontmatter. Quote `published` as a `YYYY-MM-DD` string
so YAML cannot turn an invalid calendar date into a different day. The loader
rejects missing fields, invalid dates, unsafe source URLs, and unknown fields
with the filename in the error. The page and both search indexes read the same
content files. A production build includes new entries; rebuild and deploy
after changing content.

Use `draft: true` to preview a mention in development while keeping it out of
production and search. Files beginning with `_` are ignored.

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

The archive includes coverage from 2012 through 2026. Add older or newly
discovered coverage when its source is verified. A publication's search can
find stories that general search engines miss; searching The UTD Mercury for
`Chalmers` returned several additional campus stories.

Jonsson School stories do not display publication dates in their article bodies.
Their [Fall 2021](https://engineering.utdallas.edu/news/archive/2021-fall/),
[Spring 2023](https://engineering.utdallas.edu/news/archive/2023-spring/), and
[Summer 2023](https://engineering.utdallas.edu/news/archive/2023-summer/)
archives supply those dates. The College Tour video uses YouTube's July 12,
2023 publication date. Its separate October 18 news entry is Kent Best's
Dallas Morning News story republished on The College Tour's website.

The `/media` entry in `lib/site.ts` supplies its metadata and adds it to the
footer, breadcrumbs, command palette, hover cards, search, and sitemap.
