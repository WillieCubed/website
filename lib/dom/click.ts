/**
 * True for a primary-button click with no modifier. A link that opens
 * something in place leaves every other click to the browser, so Cmd- or
 * Ctrl-click still opens a tab, Shift-click a window, and Alt-click still
 * downloads.
 */
export function isPlainClick(
  event: Pick<
    MouseEvent,
    'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'
  >
): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
