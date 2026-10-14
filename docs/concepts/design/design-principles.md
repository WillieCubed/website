# Design principles

Willie's personal site brings writing, software, organizing, research, and life
into one place. Its design should help a visitor recognize the person and find
the work, whether they arrive at the homepage or follow a link straight into an
article. The seven principles below govern that experience and the choices
used to build it.

Use them to decide what a change should do, then review the affected experience
before committing. Existing pages may still fall short. When you encounter a
gap, describe the behavior and the visitor it affects so the next change has
a clear problem to solve.

## The seven principles

### 1. Be as fun and playful as possible without being obnoxious

Give the site personality through what visitors discover and how it responds
to them. A title moving from a tile into the page it names can make navigation
both expressive and easier to follow: the visitor sees the same work opening
in a new place. The site's link for coffee offers a smaller discovery. It
leads to `/coffee`, where the server returns 418 because it is a teapot. The
joke grows out of the destination someone chose to explore.

Neither moment needs to interrupt a person reading a post. That is the limit
on playfulness: an effect that delays navigation, covers a paragraph, or
continually asks to be watched competes with the visit itself. Avoid
unsolicited sound and relentless animation. Respect reduced motion and give
visitors control over ongoing media. The site can be full of personality
without making someone manage it before they can read.

### 2. Make all core functionality and content accessible without JavaScript

Deliver the useful site in HTML. Visitors must be able to read content, follow
navigation, find information, and complete core actions with JavaScript
disabled. Working links and forms establish that foundation; previews,
transitions, shortcuts, and richer controls enhance it.

Search demonstrates how the foundation shapes an enhancement. A visitor
activates the search link to find something on the site. With scripts, the
link opens a command palette, a temporary search view; without them, its
`/search` href opens the search page. Both paths answer the same request.
A message asking the visitor to enable JavaScript would leave that request
unanswered. Give enhanced tiles the same foundation: a meaningful destination
that survives when their click handlers never run.

Review the page by loading its URL directly with scripts disabled. Testing
only the enhanced route can conceal the missing foundation because the
browser has already loaded state or content from a previous interaction.

### 3. Be user-friendly, not user-hostile

Help visitors accomplish what they came for through clear labels, readable
content, and predictable controls. A bus rider following a flyer, a legislative
staffer inspecting organizing work, and someone looking for one of Willie's
apps arrive with different context. Each needs enough information to choose a
next step without learning the site's private vocabulary.

Respect the choices the browser already gives them. Preserve back navigation,
visible keyboard focus, usable touch controls, and exits from temporary views.
Avoid forced sign-ups to read public content, misleading controls, nagging
prompts, scroll hijacking, and essential information available only on hover.
Explain an error where it occurs and give a useful next step; a failure state
is still part of the visitor's task.

The [accessibility contract](../../reference/design/accessibility.md) supplies
specific interaction and image rules. Use it alongside this principle: a
control can pass a technical check and still have a label that makes its
purpose difficult to understand.

### 4. Show, don't tell

Visitors need to understand what the work amounts to. A product screenshot
can show the result of an interaction, and a working demo lets someone try it.
A campaign's photographs and recorded outcomes can show what organizing
achieved. Choose real examples that let the
visitor examine the work, rather than asking them to accept a description
such as “innovative” or “impactful.”

Show enough context to make the example legible. Someone who has never used
an app may recognize its screen without knowing what changed or why that
result is useful. Explain the action and result beside the screenshot, and
supply image descriptions or text alternatives so the same meaning remains
available to someone who cannot see or play the media.

The example also needs to stay accurate. When a product changes, an older
capture may show an interaction it no longer offers. A modest current example
serves the visitor better than an impressive one that promises the wrong
behavior.

### 5. Build a consistent design from shared primitives and principles

Reuse the site's components, tokens, and interaction patterns wherever possible.
Spacing, type, color, focus, motion, and navigation should make similar objects
recognizable across pages. Every in-site link follows the
[`SiteLink` contract](../../reference/design/links.md), so an inline destination
does not behave differently merely because another component rendered it.

Shared primitives preserve decisions as the site changes. Improving the link's
focus behavior once should improve all of its uses; duplicating that link
creates more places where an older behavior can survive. When a primitive
lacks a useful capability, improve it before reproducing its markup elsewhere.

Consistency does not require every piece of work to look alike. A trip, a
software project, and an organizing initiative can carry different artifacts
and brand colors while sharing legible navigation and state changes. Introduce
a new pattern when the content or task calls for one, then document that reason
and how to reuse it. The common structure should help visitors understand the
differences in the work.

### 6. If something looks interactive, it should be interactive

Use native buttons for actions that change the interface, including filters,
menus, dialogs, and curation controls. Give them visible button surfaces and
clear hover, focus, pressed, and selected states. Reserve link styling for
navigation: a link should follow a destination rather than be intercepted only
to open a dialog.

Visual cues are promises. An underline suggests a link; a button suggests an
action; a handle suggests something can be dragged. Pointer cursors, hover
treatments, and press feedback must match actual behavior. A static object
styled like an actionable tile asks a visitor to spend an action discovering
that the promise was empty.

Make the suggested action available by keyboard and touch, with the appropriate
semantics and visible focus. If an object has no action, remove the cues that
imply one. If an action is unavailable, communicate its disabled state and,
where useful, the reason. Leaving a control apparently active while silently
ignoring a press turns a known limitation into a confusing failure.

Review the resting state as well as the hover state. A design that becomes
clear only after a mouse arrives has not yet explained itself to a person using
a phone or keyboard.

### 7. Aggressively optimize for the visitor's performance and resource usage

Treat bandwidth, CPU, memory, and battery as resources the visitor spends to
use the site. The intended experience should justify that cost. Appropriately
sized media, lightweight interactions, shared assets, and promptly visible
content usually serve the visitor better than making them download work they
may never inspect.

Load optional media and enhancements when needed. Avoid unnecessary scripts,
dependencies, requests, and speculative downloads; pause ongoing animation or
media work when offscreen or when the page is hidden. Respect reduced-motion
and data-saving preferences where available. A quiet-looking page can still
consume resources in the background, so visual inspection alone cannot settle
this principle.

Measure changes that could materially affect loading or responsiveness on a
phone-sized viewport with constrained network and CPU conditions. Compare the
same flow before and after: transferred bytes show the download cost,
JavaScript work contributes to startup and response delays, and layout shifts
can move a target while someone tries to press it. Include responsiveness and
layout stability alongside the transfer and script measurements.

Investigate regressions. When a richer experience requires more resources,
record what the visitor gains and why that benefit warrants the measured cost.

## Before committing

### Review the affected experience

Review the pages and interactions your change affects, using the checklist
below. Mark an item not applicable only when the change cannot affect it. If
an item remains unmet, describe the behavior in the change description so the
review records the actual result, including what still needs work.

- [ ] **Playful:** The change adds or preserves personality without obstructing
      reading or actions. Check reduced motion and control of ongoing media
      when adding motion or media.
- [ ] **Works without JavaScript:** Disable JavaScript and reload the affected
      pages directly. Verify their content, navigation, and core actions,
      including any alternative to an enhanced control, still work.
- [ ] **User-friendly:** Check the affected flow with a keyboard, at a phone
      width, and with browser back and forward. Labels, focus, errors, and exits
      remain clear; essential information is available without hover.
- [ ] **Shows the work:** Claims have concrete examples or artifacts where
      useful, with context and accessible alternatives for meaningful media.
- [ ] **Consistent:** Use shared components, tokens, and established behavior.
      Explain any new pattern and check whether it belongs in a shared primitive.
- [ ] **Honest interaction cues:** Every interactive-looking object performs
      its suggested action with a pointer, keyboard, and touch as appropriate.
      Static objects do not falsely advertise an action.
- [ ] **Efficient:** Check new downloads and ongoing background or offscreen
      work. For changes that affect performance, compare the affected flow
      before and after under constrained conditions and explain regressions.

### Keep checks proportional and claims specific

Every visual iteration includes uncropped full-viewport screenshots at desktop
and mobile sizes. Full-page captures supplement those views; a cropped component
cannot show how the change fits the viewport or neighboring content.

A passing automated check does not replace browser review. The image validator
can reject missing alt text, for example, but it cannot decide whether a photo
actually explains the claim beside it. A keyboard check can show that focus
returns to the opener; it does not prove every screen-reader announcement.
Report the browser, flow, and limits needed to understand the evidence.

Existing gaps should remain visible. If a page transition still cuts during
browser back navigation, describe that behavior instead of marking all motion
as verified because forward navigation looks right.

## Visual and interaction direction

The direction below applies the seven principles to the site's identity.
Motion and richer interactions are progressive enhancements; their reduced
or absent forms must preserve the same content and destinations.

### Warm: make the person visible

Headings stand on their own, without decorative overline or eyebrow text.
Put useful metadata, such as a playlist's position or track count, below its
title. Keep labels where someone needs them to use a control or field.

The site should feel like a person: warm neutral backgrounds, soft corners,
real photos and video, and copy that sounds like Willie talking. Cold greys,
black-and-neon palettes, and corporate stat banners break that direction.

A photograph from a trip or a capture of a project gives that visual treatment
something personal to hold. It shows a part of Willie's life or work that a
visitor can recognize and explore. A generic productivity banner would leave
them with little sense of whose site they had found, even in the right colors.
Choose the material and its treatment together.

### Fluid: make state changes understandable

When something on the page changes, it moves there. Sections reorder, expand,
and come into focus smoothly instead of jumping. When an object persists
between states or pages, such as a tile opening into its detail view, it
morphs between those places and back when the visitor returns.

An object should appear once. When it belongs in two places, it moves between
them, as the homepage's contact row grows into the footer. This gives motion
a relationship to explain: the visitor sees where an existing object went,
rather than watching unrelated decoration run alongside the content.

Every motion has a reduced-motion fallback. The relationship must also remain
understandable when the change happens at once; animation cannot be the only
explanation of the new state.

### Approachable: provide an immediate way in

Someone landing on the site should recognize within a few seconds who Willie
is and where the thing they came for lives. Use plain words and legible type.
Give a bus rider, legislative staffer, recruiter, or app visitor enough context
to choose a destination without assuming they share Willie's interests.

Never put information only behind hover. A contextual hint can help someone
explore, but the visible text and destination must carry the meaning on a
phone, with a keyboard, and without the enhancement.

### Interactive: respond through the object itself

Content responds to the visitor. Hover can reveal context fitted to the thing
under the pointer: a one-line hint about what opening it shows, or the other
work connected to a word in the prose. Focus and selection answer through
subtle movement, such as an easing focus ring, a lifting card, or a press that
gives slightly.

Keep these responses on the object the visitor is using. A card that lifts
helps identify the card under the pointer; an unrelated background animation
does little to explain that choice. The focused hover treatment at
[ja.mt](https://ja.mt/) is a reference for this relationship: one item gains
emphasis while the surrounding items recede. Shared element transitions carry
the relationship across states or pages. Ordinary content and navigation
remain usable when neither enhancement runs.

### Responsive: adapt space and emphasis

Start with a 390px phone and scale up. The site also responds to time: current
work surfaces first and older work steps back without someone editing the
homepage by hand. Space and recency both affect what deserves prominence.

Layouts use the Material 3 window size classes because the codebase already
uses Material 3 tokens and MUI. Keeping those boundaries aligned gives layout
changes the same vocabulary as the existing design system.

| Class    | Width      | Homepage layout                                       |
| -------- | ---------- | ----------------------------------------------------- |
| Compact  | < 600px    | One stacked column                                    |
| Medium   | 600–839px  | Stacked, full-width text, two-column list and tiles   |
| Expanded | 840–1199px | Sticky rail beside a two-column grid sized to content |
| Large    | ≥ 1200px   | Sticky rail beside a six-column grid                  |

On compact and medium, the first screen stops at its natural height so part of
the first tile appears below it. A layout fitted exactly to the viewport can
suggest there is nothing farther down. Showing the start of the work gives
the visitor a visible reason to scroll.

## Brand

### Let the site's palette establish the resting state

At rest, every component uses the site's own warm neutral palette. Pointing
at, focusing, or opening a venture brings in that venture's colors: its tile,
list row, and detail view switch to a Material 3 scheme built from the
venture's brand color. The site remains recognizable as Willie's place while
the active work gains its own identity.

The scheme uses the Fidelity variant to keep the brand color as its primary.
The Expressive variant was rejected because it rotates the primary hue and
turned Las Vegans for Better Transit's orange into blue. That result would
make an interaction erase a recognizable part of the venture's identity at
the moment the visitor focuses on it.

### Resolve seeds from the venture's public presentation

Each venture's public site supplies the starting color, or seed, for its
scheme. Using that presentation ties the personal site's treatment to the
venture's own identity instead of maintaining an independent color choice.
Do not enter those colors by hand.

`brand/resolve-brands.mjs` reads the public site and selects the first saturated
color it finds, checking the web manifest, theme-color meta tag, primary-button
styles, and SVG icon in that order. It writes the result to
`lib/brand/seeds.json`, which the page uses to generate schemes. If a scheme
looks wrong, that order tells you which source may have supplied the seed.

Run the resolver again when a site rebrands. If a site produces no saturated
color or cannot be fetched, the current script preserves its previous seed;
without a previous seed it remains neutral. Preserving an old seed can keep a
venture recognizable during a failed fetch, but it also means a successful
script run alone cannot prove every seed reflects the current brand.

Build-time resolution is an intended part of the Next.js port, not established
by the current `build` script. Keep that remaining work distinct from the
manual resolver that exists today. The WillieCubed logo has its own generated
[rules and kit](../../reference/design/brand.md); venture color schemes do not
change those logo usage rules.

## Page transitions

### Move elements that represent the same thing

A visitor opening an initiative should recognize the work they selected as
its full page appears. The initiative name therefore moves from its homepage
tile or `/initiatives` card into the page heading. A writing card's title
moves into the post heading in the same way. Only the larger title's snapshot
is drawn during the morph, so the visitor sees one title changing position
and size instead of two copies fading into each other. Notes have no visible
title and supply no title to morph.

The top bar also persists. It keeps its size and slides to the new page's
column, already showing the new breadcrumbs. Everything outside the named
participants cuts over to the new page; there is no whole-page crossfade to
make unrelated content appear continuous.

`components/site/SharedTitle.tsx` and `components/site/TopBar.tsx` implement
these participants with React's `<ViewTransition>` through the local wrapper
in `components/site/view-transition.tsx`. The installed App Router supports
it without a flag in this Next version; see the local guide at
`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`. The
implementation names participants while the navigation transition runs.

### Preserve the destination when a morph cannot run

The rules live in `app/globals.css`. Under reduced motion, elements jump to
their new places at once. React animates only what is in the viewport, so a
title scrolled out of view cuts. A morph also needs the destination prefetched:
if a page commits behind a loading state, it forms no pair and cuts.

These limits make the underlying navigation especially important. The content
and destination must make sense even when there is no visual pairing.
`tests/e2e/site/site/view-transitions.spec.mts` records the names React sets on both pages
and the groups the browser animates; it checks the mechanism rather than
proving every navigation will produce a morph.

### Browser history remains a known limitation

The browser's back and forward buttons do not morph yet. Next restores the
page the visitor left through its `<Activity>` cache, and React does not pair
elements across that restore, so the page cuts. Following a link back, such as
the top bar's name, morphs as expected.

When checking a round trip, test both ways of returning: an in-page link and
the browser's history controls. They currently take different paths, so the
smooth linked return does not describe what someone sees after pressing Back.

## Reference sites

Willie chose four sites as inspiration. Each contributes a particular idea
that can be considered against this site's own content and principles.

| Site                                              | What informs this design                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| [ja.mt](https://ja.mt/)                           | Hover focuses one item, blurs the rest, and fans out its thumbnail stack. |
| [chester.how](https://chester.how/)               | Prose makes key words live, and a grid mixes life with projects.          |
| [maggieappleton.com](https://maggieappleton.com/) | A one-sentence thesis headline and typed content that lifts on hover.     |
| [floriankiem.com](https://floriankiem.com/)       | A quiet rail sits beside real artifacts of the work, without decoration.  |

The useful question is how each relationship would serve this site's content.
A thumbnail fan can help someone inspect several captures of one project.
The quiet rail can leave more attention for the work beside it. Adopt a
relationship when the material benefits from it, then apply the seven
principles to its motion, access, and cost.

## Open questions

### Keeping real media representative

The homepage uses media captured from each venture's public site. Those captures
can go stale when the products change. The value of showing real work depends
on continuing to represent it accurately; the current use of public captures
does not settle how often they should be refreshed.

### Understanding how visitors arrive

The assumption that most organizing traffic arrives on phones from social
links and flyers remains unverified until the site has analytics. Designing
from a phone-sized viewport is a declared direction, but the audience claim is
still a hypothesis. Keep those separate when assessing future layout or
navigation changes, and use observed arrival paths when evidence becomes
available.
