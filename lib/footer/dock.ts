/**
 * The maths behind the homepage footer. On the homepage the footer is not a
 * separate block: it starts as the contact row at the foot of the rail and
 * opens into the full footer over the last stretch of scroll, so every link
 * on the page appears once. Everything it draws is a function of one number,
 * p: 0 while the page above still fills the window, 1 once the footer's own
 * height has scrolled into view. FooterDock writes p onto the footer as --p
 * and footer-dock.css derives the rest from it.
 */

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 0 at `from`, 1 at `to`, straight between. */
export function ramp(p: number, from: number, to: number): number {
  return clamp01((p - from) / (to - from));
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
