/**
 * The maths behind the homepage footer. On the homepage the footer is not a
 * separate block: it starts as the contact row at the foot of the rail and
 * opens into the full footer over the last stretch of scroll, so every link
 * on the page appears once. Everything it draws is a function of one number,
 * p: 0 while the page above still fills the window, 1 once the footer's own
 * height has scrolled into view. site.css does the drawing; FooterDock
 * writes these values onto the footer as custom properties.
 */

/** The footer's fixed measures, mirrored from site.css and globals.css. */
export const FOOTER = {
  /** Space above the lockup once the footer is open. */
  padTop: 48,
  /** Space below the contact row. */
  inset: 28,
  rowHeight: 40,
  lockupHeight: 48,
  /** How far the collapsed row's surface reaches past the row itself. */
  pillPadY: 6,
} as const;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 0 at `from`, 1 at `to`, straight between. */
export function ramp(p: number, from: number, to: number): number {
  return clamp01((p - from) / (to - from));
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface ScrollMetrics {
  scrollY: number;
  viewportHeight: number;
  scrollHeight: number;
  footerHeight: number;
}

/**
 * How much of the footer's own stretch of scroll has come into view. The
 * footer is the last thing on the page and sticks to the bottom of the
 * window, so the last `footerHeight` pixels of the document are that
 * stretch, and no spacer is needed to make room for the opening.
 */
export function footerProgress({
  scrollY,
  viewportHeight,
  scrollHeight,
  footerHeight,
}: ScrollMetrics): number {
  if (footerHeight <= 0) return 0;
  const start = scrollHeight - footerHeight;
  return clamp01((scrollY + viewportHeight - start) / footerHeight);
}

export interface DockVars {
  /** How far open the footer is. The top edge and the lockup follow it. */
  p: number;
  /** How far the sides have opened. They open first and fast. */
  wide: number;
  /** How solid the footer's surface is. */
  surface: number;
  /** How far the row has taken on the footer's look: icons and ink. */
  dock: number;
  /** How far the cube's seat in the row has emptied. */
  leave: number;
  /** On a phone, how far the row's surface has grown out of nothing. */
  appear: number;
}

/**
 * The values the footer draws from at a given p. On a phone the row is not
 * pinned while scrolling: it grows out of nothing as the page ends, already
 * in the footer's look.
 */
export function dockVars(p: number, compact: boolean): DockVars {
  return {
    p,
    wide: easeOut(ramp(p, 0, 0.6)),
    surface: ramp(p, 0, 0.12),
    dock: compact ? 1 : ramp(p, 0, 0.5),
    leave: ramp(p, 0.15, 0.5),
    appear: compact ? ramp(p, 0, 0.08) : 1,
  };
}

/**
 * Where the top edge of the opening is, in px from the top of the footer.
 * Mirrors the first inset of the footer's clip-path in site.css.
 */
export function openingTop(p: number, footerHeight: number): number {
  const { inset, rowHeight, pillPadY } = FOOTER;
  return (footerHeight - inset - rowHeight - pillPadY) * (1 - p);
}

/**
 * Where the top of the lockup is, in px from the top of the footer. It rides
 * from the head of the row up to its place above the tagline, straight with
 * p, so it stays just inside the rising top edge. Mirrors the lockup's `top`
 * in site.css.
 */
export function lockupTop(p: number, footerHeight: number): number {
  const { padTop, inset, rowHeight, lockupHeight } = FOOTER;
  const seat = footerHeight - inset - (rowHeight + lockupHeight) / 2;
  return padTop + (seat - padTop) * (1 - p);
}
