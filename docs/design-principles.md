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
expand, and come into focus smoothly instead of jumping. When an element persists
between two states or pages, such as a tile that opens into a detail view, it
morphs between them with a shared element transition and morphs back when the
visitor returns. An element appears on the page once; when it belongs in two
places, it moves between them, as the homepage's contact row grows into the
footer. Motion comes from content changing state, never from decoration
running on its own. Every motion has a reduced-motion fallback.

**Approachable.** Anyone who lands on the site can tell within a few seconds
who Willie is and where their thing lives. That includes a bus rider who
scanned a flyer, a legislative staffer, a recruiter, and someone who found one of
Willie's apps. Use plain words and legible type, and never put information
only behind a hover.

**Interactive.** The content responds to the visitor. Hover reveals context
that fits the thing under the pointer, such as a one-line hint about what opening
it shows or the other work a word connects to. Focus and selection answer with
subtle movement, such as a focus ring that eases in, a card that lifts, or a
press that gives slightly. Interaction belongs on real objects on the page, not
on ambient canvases or background effects. Jace-style hover focus and shared
element transitions are the minimum, not extras.

**Responsive.** The site works first on a 390px phone and scales up from there.
It also responds to time, so current work surfaces first and older work steps
back without anyone editing the homepage by hand. Layouts change at the Material
3 window size classes, because the codebase already uses Material 3 tokens and
MUI:

| Class    | Width      | Homepage layout                                       |
| -------- | ---------- | ----------------------------------------------------- |
| Compact  | < 600px    | One stacked column                                    |
| Medium   | 600–839px  | Stacked, full-width text, two-column list and tiles   |
| Expanded | 840–1199px | Sticky rail beside a two-column grid sized to content |
| Large    | ≥ 1200px   | Sticky rail beside a six-column grid                  |

The first screen on compact and medium stops at its natural height so part of
the first tile shows below it. A layout that exactly fills the viewport reads
as a page that cannot scroll.

## Brand

The site is Willie's personal brand, so at rest every component uses the site's
own warm neutral palette. Pointing at, focusing, or opening a venture takes on
that venture's colors: its tile, list row, and detail view switch to a Material
3 scheme built from the venture's brand color. The scheme uses the Fidelity
variant, which keeps the brand color as the primary. The Expressive variant was
rejected because it rotates the primary hue and turned Las Vegans for Better
Transit's orange into blue.

Nobody enters a brand color by hand. A resolver script reads each venture's
site and takes the first saturated color it finds in the web manifest, the
theme-color meta tag, the primary buttons, or the icon, then writes the seeds
to a JSON file that the page turns into schemes. A venture whose site yields no
saturated color stays neutral. The script has to be rerun when a site rebrands,
and the Next.js port should run it at build time.

## Page transitions

Navigations between pages run through React's `<ViewTransition>`, which the
App Router supports without a flag in this Next version
(`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). React
names an element only while a navigation's transition runs, and it leaves
everything it has not named out of the transition, so the rest of the page
cuts over and nothing crossfades. Two kinds of element move:

- The top bar (`components/site/TopBar.tsx`) keeps its size and slides to
  the new page's column, already showing the new page's crumbs.
- A title that names the same thing on both pages morphs from one to the
  other through `components/site/SharedTitle.tsx`: a homepage tile's or an
  `/initiatives` card's initiative name into the initiative page's heading,
  and a writing card's title into the post's heading. Only the larger
  title's snapshot is drawn, so two copies never fade into each other.

The rules live in `app/globals.css`. Under reduced motion every element
jumps to its new place at once. React animates only what is in the
viewport, so a title scrolled out of view cuts. A morph also needs the
destination prefetched: a page that commits behind a loading state forms
no pair and cuts. A note has no visible title, so opening one never
morphs. `tests/e2e/view-transitions.spec.mts` records the names React sets
on both pages and the groups the browser animates.

The browser's back and forward buttons do not morph yet. Next restores a
page the visitor left from its `<Activity>` cache, and React does not pair
elements across that restore, so the page cuts. Following a link back,
such as the top bar's name, morphs as expected.

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

The homepage uses real media captured from each venture's public site, so
those captures go stale when the products change. The assumption that most organizing traffic
arrives on phones from social links and flyers is unverified until the site has
analytics.
