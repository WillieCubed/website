import type { KeyboardEvent } from 'react';

export function detailDialogKeyDown(
  event: KeyboardEvent<HTMLDialogElement>,
  dialog: HTMLDialogElement | null
) {
  if (event.key === 'Tab') {
    wrapDialogFocus(event, dialog);
    return;
  }
  scrollDialogContent(event, dialog, '.mp-detail-scroll');
}
function wrapDialogFocus(
  event: KeyboardEvent<HTMLDialogElement>,
  dialog: HTMLDialogElement | null
) {
  const controls = Array.from(
    dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]'
    ) ?? []
  ).filter(
    (element) => element.tabIndex >= 0 && element.getClientRects().length
  );
  const index = controls.indexOf(document.activeElement as HTMLElement);
  const wrap = event.shiftKey
    ? index <= 0
    : index < 0 || index === controls.length - 1;
  if (wrap && controls.length) {
    event.preventDefault();
    controls[event.shiftKey ? controls.length - 1 : 0].focus();
  }
}
export function scrollDialogContent(
  event: KeyboardEvent<HTMLDialogElement>,
  dialog: HTMLDialogElement | null,
  selector: string
) {
  const scroller = dialog?.querySelector<HTMLElement>(selector);
  if (
    !scroller ||
    scroller.contains(event.target as Node) ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  const distances: Record<string, number> = {
    ArrowDown: 40,
    ArrowUp: -40,
    PageDown: scroller.clientHeight * 0.85,
    PageUp: -scroller.clientHeight * 0.85,
    Home: -scroller.scrollHeight,
    End: scroller.scrollHeight,
  };
  if (!(event.key in distances)) return;
  event.preventDefault();
  scroller.scrollBy({ top: distances[event.key], behavior: 'instant' });
}
