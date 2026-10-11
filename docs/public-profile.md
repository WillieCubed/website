# Public profile pages

This note is for the maintainer who edits About or Research. Keep these pages
limited to public work and check each source before changing a claim.

## Design and implementation

The October 10, 2026 design uses the site's 840px content column, its warm
neutral surfaces, and the existing top bar. Each page starts with its name and
an introduction. About pairs its introduction with the existing portrait.
Research groups three questions before current work and dated research coverage.
The alternative was restoring the old resume and research pages. Their long
lists and dated model commentary do not describe the current public work.

The implementation follows three steps. Build the two route pages with the
existing metadata, links, and shared titles. Read public venture records without
rewriting their descriptions. Route only these two pages through `sitePages`.
Build and visual verification happen after integration with the shared site
changes. Check desktop and 390px renders in both themes, including the footer.

## Sources and privacy

`lib/site.ts` provides the identity sentence and public organizations.
`lib/home/focuses.ts` provides About's focus lines. About includes only focuses
served by a visible public venture. `lib/home/ventures.ts` provides every work
card's exact name and description. Both pages link to existing homepage detail
views, and the list component excludes hidden ventures.

`app/_(pages)/about/page.tsx` records the August 2023 computer science degree,
2019–2023 Student Senate service, and the dated AI research experience. These
are historical claims. The new page does not restore the resume's employment
list or its availability claim. `public/assets/headshot.jpg` is the existing
1157px square portrait. Its new description follows a visual inspection of
the image.

`app/_(pages)/research/page.tsx` provides the research interests and the three
question headings. The new question descriptions explain those themes without
claims about publications or results. The current Lovelace reference comes
from the public homepage records.

`content/media/ut-dallas-clark-scholars.md` provides the title, publication, date,
and external link for the August 15, 2019 coverage. Research reads it through
`getMediaMentions({ includeDrafts: false })`. The source URL returned 502 during
implementation, so the media record remains the source for that link.

Neither route loads projects, writings, or initiatives. Neither changes a draft flag.
No `/research/[projectId]` page moves out of the parked folder. Draft detail
pages stay private. A future research bibliography needs public, verified
records before adding entries.
