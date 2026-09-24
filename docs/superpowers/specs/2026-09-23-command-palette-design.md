# Command palette

Status: designed 2026-09-23, not yet planned. This is part B1 of three
homepage changes; part A (footer sheet) is built and part C (rail focuses)
has its own spec. Part B2, owner sign-in and owner-only commands, gets its
own spec after this ships.

Site search today is Pagefind's Component UI: a stock `<pagefind-modal>` and
`<pagefind-modal-trigger>` (components/search). It cannot morph out of its
trigger, it draws its parts with divider lines, and it can only search. The
palette replaces it with our own UI over the same Pagefind index, and adds
navigation, quick actions, and the site's protocol easter eggs.

## Decisions

| Question                | Decision                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Built on                | Our own UI. Pagefind stays as the index, called through its JS API; its Component UI is removed         |
| What it does            | Search, go places, quick actions, easter eggs. Owner tools are B2                                       |
| Trigger on the homepage | In the rail, as its own group between the intro and the focuses                                         |
| Trigger elsewhere       | The top bar's compact trigger, as today. One trigger per page                                           |
| Footer "Search" link    | Removed. `/search` stays, linked from `<noscript>` in the top bar for visitors without scripting        |
| Opening motion          | The trigger's container morphs into the palette with a same-document view transition, and back on close |
| Separation              | Tonal surfaces only (Material 3 Expressive). No divider lines or hairline borders                       |
| Empty state             | A small "now" view: Latest, Go to, Do                                                                   |
| Easter eggs             | Exact-match commands that do real things; never listed, hinted at by the placeholder                    |

## Commands

`lib/palette/commands.ts` holds the registry. Each command is
`{ id, title, group, keywords, href | run, egg? }`, where `run` may return a
result to show inside the palette. The registry is plain data plus functions,
so B2 can add owner commands without changing the palette.

- **Go to:** the routed pages (`routedPages` in lib/site.ts), each venture,
  each initiative, and the latest writings. Built from existing data.
- **Do:** copy email, open each social profile, the feeds (as in
  FeedsButton), switch light or dark.
- **Eggs:** matched only when the whole input equals the command name.

| Type                       | Does                                                                             | Behind it               |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| `brew`, `coffee`, `teapot` | Sends the real `POST /coffee` and shows the 418, its headers, and body           | app/coffee              |
| `tea`                      | Brews at `/tea` and shows the response                                           | app/tea                 |
| `whoami`                   | Shows what the server sees about the request, only lines the host provides       | /whoami, lib/whoami.ts  |
| `fortune`                  | A random tagline; Enter draws another                                            | lib/tagline_data.json   |
| `clacks`                   | Reads `X-Clacks-Overhead` off a live response                                    | lib/response-headers.ts |
| `mcp`                      | Shows the MCP endpoint and copies a client config                                | /api/mcp                |
| `llms`                     | Opens `/llms.txt`                                                                | llms.txt                |
| `security`                 | Shows security.txt's contact and expiry                                          | security.txt            |
| `sudo`                     | Starts owner sign-in; until B2 exists, says plainly that sign-in is not wired up | /indieauth/consent (B2) |
| `:q`, `exit`               | Closes the palette                                                               |                         |

An egg's result shows in its own tonal container, in the site's mono font,
like a terminal readout. A failed request shows what failed, never a made-up
response. New eggs join when they are real (mail roles, TXT fortunes).

## Components

- `components/palette/PaletteProvider.tsx`: open state, the ⌘K / Ctrl+K
  shortcut on every page, and which trigger opened it (for the morph and for
  returning focus).
- `components/palette/PaletteTrigger.tsx`: one component, two sizes: `rail`
  (a tonal container with the ⌘K hint) and `compact` (the top bar's).
  Replaces `PagefindTrigger`.
- `components/palette/Palette.tsx`: a modal `<dialog>` in the top layer with
  the input, the result groups, and egg results.
- `lib/palette/search.ts`: loads `/pagefind/pagefind.js` on first open,
  searches with a short debounce, and maps results to rows grouped by type
  (writings, initiatives, pages) with Pagefind's highlighted excerpt.
- Removed: `components/search/SearchModal.tsx`, `components/search/pagefind.tsx`,
  and the Component UI CSS and script loading. The Pagefind index build
  (`addCustomRecord` from the shared collector) is unchanged.

## Layout

- The palette is a large rounded card on a tonal surface. The input sits in
  a higher tonal container at the top.
- Each result group is its own tonal container with a quiet label. The
  active row takes the secondary container fill. No row separators.
- Wide windows: centred near the top, about 640px wide. Phones: full width
  at the top of the screen, clear of the keyboard.

## States

- **Empty:** Latest (newest writing, current initiative part), Go to (main
  pages), Do (copy email, feeds, theme).
- **Typing:** matching commands first, then search results by type.
- **Egg:** the egg's readout replaces the result list until the input
  changes.
- **Hint:** now and then the placeholder rotates through a few eggs
  ("try: brew").

## Motion

The open trigger and the dialog's card share one `view-transition-name`.
Opening wraps `showModal()` in `document.startViewTransition`, so the
trigger's container grows into the card; closing runs the reverse into the
same trigger. Without view transitions it opens without animation; under
reduced motion it crossfades briefly. Results change in place without
animation beyond the active row's fill easing.

## Accessibility

The input is a combobox that controls a listbox, with
`aria-activedescendant` for the active row. Up and Down move, Enter runs,
Escape closes, and focus returns to the trigger that opened it. Egg readouts
are announced through a polite live region.

## Testing

- Unit: command matching (partial matches never reach eggs, exact matches
  do), registry ids are unique, Go to entries point at real routes.
- Playwright: ⌘K opens on the homepage and a writing page; a query returns
  Pagefind results; `brew` shows a 418; Escape restores focus to the trigger;
  axe passes with the palette open.

## Out of scope

Owner sign-in and owner-only commands (B2), and any change to what Pagefind
indexes.
