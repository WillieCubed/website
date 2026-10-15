'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export function useMusicReview() {
  const [isOpen, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen || dialog.current?.open) return;
    dialog.current?.showModal();
    dialog.current
      ?.querySelector<HTMLElement>('#mp-review-title')
      ?.focus({ preventScroll: true });
    if (dialog.current) dialog.current.scrollTop = 0;
  }, [isOpen]);

  function close() {
    flushSync(() => setOpen(false));
    trigger.current?.focus({ preventScroll: true });
  }
  return {
    isOpen,
    dialog,
    trigger,
    show: () => setOpen(true),
    hide: () => setOpen(false),
    close,
  };
}
