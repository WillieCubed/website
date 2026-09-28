'use client';

import { useRef } from 'react';

type DialogPointer = React.MouseEvent<HTMLDialogElement>;

/** True when the event landed on the dialog's backdrop, outside its box. */
function onBackdrop(event: DialogPointer): boolean {
  if (event.target !== event.currentTarget) return false;
  const box = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

/**
 * Handlers that dismiss a modal dialog when the visitor clicks its backdrop.
 * A backdrop click lands on the dialog element itself, outside its box. So
 * does the click that ends a text selection dragged out past the card's
 * edge, because a click goes to the element the press and the release
 * share, so the press has to have started on the backdrop too.
 */
export function useBackdropDismiss(onDismiss: () => void) {
  const pressedBackdrop = useRef(false);
  return {
    onPointerDown: (event: React.PointerEvent<HTMLDialogElement>) => {
      pressedBackdrop.current = onBackdrop(event);
    },
    onClick: (event: DialogPointer) => {
      const pressed = pressedBackdrop.current;
      pressedBackdrop.current = false;
      if (pressed && onBackdrop(event)) onDismiss();
    },
  };
}
