# Design principles

These principles govern the relaunch of Willie's personal site. They are for
anyone designing or building a page on it, Willie or an agent. Check every
visual and interaction decision against them before shipping it. They replace
the neubrutalist direction described under "Design Tidbits" in
[index.md](./index.md), which covered the previous site.

## The five principles

**Warm.** The site feels like a person, not a product. That means a warm
neutral background, soft corners, real photos and video, and copy that sounds
like Willie talking. Cold greys, black-and-neon palettes, and corporate stat
banners break it.

**Fluid.** When something on the page changes, it moves there. Sections reorder,
expand, and come into focus smoothly instead of jumping. Motion comes from
content changing state, never from decoration running on its own. Every motion
has a reduced-motion fallback.

**Approachable.** Anyone who lands on the site can tell within a few seconds
who Willie is and where their thing lives. That includes a bus rider who
scanned a flyer, a legislative staffer, a recruiter, and someone who watches The
Willie Diaries. Use plain words and legible type, and never put information
only behind a hover.

**Interactive.** The content responds to the visitor. Words, projects, and
media react when someone points at, taps, or focuses them. Interaction belongs
on real objects on the page, not on ambient canvases or background effects.

**Responsive.** The site works first on a 390px phone and scales up from there.
It also responds to time, so current work surfaces first and older work steps
back without anyone editing the homepage by hand.

## Brand

The site is Willie's personal brand. Las Vegans for Better Transit, the
Rebuilding America Project, and The Willie Diaries appear on it as work Willie
does, not as sub-brands, so their logos, palettes, and type stay on their own
sites. A component may take a faint color hint from its own media, such as the
average tint of a real thumbnail, but it never adopts an initiative's brand
colors outright. Where no real media exists, the component stays neutral.

## Reference sites

Willie chose four sites as inspiration. Each one contributes something specific:

- [ja.mt](https://ja.mt/): hover focuses one item, blurs the rest, and fans out
  its thumbnail stack.
- [chester.how](https://chester.how/): prose where key words are live, and a grid
  that mixes life with projects.
- [maggieappleton.com](https://maggieappleton.com/): a one-sentence thesis
  headline, and typed content that lifts on hover.
- [floriankiem.com](https://floriankiem.com/): a quiet rail beside real artifacts
  of the work, with no decoration.

## Open questions

The Rebuilding America Project and The Willie Diaries have no public web
presence yet, so every design direction uses placeholders for their
descriptions, episodes, and media. The assumption that most organizing traffic
arrives on phones from social links and flyers is unverified until the site has
analytics.
