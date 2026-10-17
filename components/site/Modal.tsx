'use client';

import {
  type ComponentProps,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { useBackdropDismiss } from './useBackdropDismiss';

interface ModalProps extends Omit<
  ComponentProps<'dialog'>,
  'ref' | 'open' | 'onCancel' | 'onClose' | 'onPointerDown' | 'onClick'
> {
  ref?: Ref<HTMLDialogElement>;
  /**
   * Shows the dialog as a modal while true and closes it when false, then
   * returns focus to whatever had it. Leave it unset when a view transition
   * presents the dialog, which then opens, closes and returns focus itself.
   */
  open?: boolean;
  /**
   * Renders the dialog open in the server HTML, so a linked view reads
   * before the client upgrades it to a modal. Only the first render counts.
   */
  initiallyOpen?: boolean;
  /** Escape or a click on the backdrop asks the owner to close. */
  onDismiss: () => void;
  /**
   * The browser closed the dialog without a cancel to intercept, such as on
   * a second Escape in a row. With `open`, this defaults to `onDismiss`.
   */
  onForcedClose?: () => void;
  /** Selects the element that takes focus each time `open` shows the dialog. */
  initialFocus?: string;
}

/**
 * The site's modal dialog: a native `<dialog>` that Escape and its backdrop
 * dismiss through one callback, so every modal closes the same ways.
 */
export default function Modal({
  ref,
  open,
  initiallyOpen = false,
  onDismiss,
  onForcedClose,
  initialFocus,
  ...props
}: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [renderedOpen] = useState(initiallyOpen);
  const backdrop = useBackdropDismiss(onDismiss);
  useImperativeHandle(ref, () => dialog.current!, []);

  useEffect(() => {
    const modal = dialog.current;
    if (!open || !modal) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!modal.matches(':modal')) {
      if (modal.open) modal.close();
      modal.showModal();
    }
    if (initialFocus)
      modal
        .querySelector<HTMLElement>(initialFocus)
        ?.focus({ preventScroll: true });
    return () => {
      modal.close();
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [open, initialFocus]);

  return (
    <dialog
      ref={dialog}
      open={renderedOpen || undefined}
      {...props}
      {...backdrop}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClose={(event) => {
        // A close that `open` asked for is handled already, and one the
        // dialog has reopened from, such as a remount or an upgrade to a
        // modal, is not the browser's.
        if (open === false || event.currentTarget.open) return;
        (onForcedClose ?? (open ? onDismiss : undefined))?.();
      }}
    />
  );
}
