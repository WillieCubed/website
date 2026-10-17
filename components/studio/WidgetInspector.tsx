'use client';

import {
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';
import Modal from '@/components/site/Modal';

import { StudioInspectorHostContext } from './StudioInspectorHost';
import { StudioSaveContext } from './StudioSaveContext';

/** Keep authoring controls outside the document and its reader-facing widget. */
interface WidgetInspectorProps {
  id: string;
  name: string;
  onDismiss: () => void;
  onRemove: () => void;
  children: ReactNode;
}

export default function WidgetInspector({
  id,
  name,
  onDismiss: onDismissed,
  onRemove,
  children,
}: WidgetInspectorProps) {
  const status = useContext(StudioSaveContext);
  const host = useContext(StudioInspectorHostContext);
  const { dialog, closing, onDismiss } = useInspectorPresentation(
    host,
    onDismissed
  );
  return (
    host &&
    createPortal(
      <Modal
        ref={dialog}
        id={id}
        className="studio-widget-inspector"
        data-closing={closing || undefined}
        aria-labelledby={`${id}-title`}
        onDismiss={onDismiss}
        // A responsive mode change closes then reopens this same dialog,
        // which Modal ignores, so a forced close always ends the session.
        onForcedClose={onDismiss}
        onKeyDown={(event) => {
          event.stopPropagation();
          trapModalTab(event);
          if (event.key === 'Escape') {
            event.preventDefault();
            onDismiss();
          }
        }}
      >
        <header className="studio-inspector-header scroller">
          <h2 id={`${id}-title`} tabIndex={-1}>
            {name}
          </h2>
          <Button
            variant="quiet"
            iconOnly
            aria-label="Close widget settings"
            onClick={onDismiss}
          >
            <Icon name="x" />
          </Button>
        </header>
        <div className="studio-inspector-content scroller">{children}</div>
        <footer className="studio-inspector-footer scroller">
          <Button variant="quiet" onClick={onRemove}>
            Remove block
          </Button>
          <p className="studio-inspector-save">
            {status === 'All changes saved'
              ? 'Saved'
              : status === 'Unsaved changes'
                ? 'Editing'
                : status}
          </p>
        </footer>
      </Modal>,
      host
    )
  );
}

function trapModalTab(event: React.KeyboardEvent<HTMLDialogElement>): void {
  if (event.key === 'Tab' && event.currentTarget.matches(':modal')) {
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href], [tabindex="0"]'
      )
    ).filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !controls.includes(document.activeElement as HTMLElement))
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}

/** Dialog lifetime owns responsive modality, keyboard fitting and animated dismissal. */
function useInspectorPresentation(
  host: HTMLElement | null,
  onDismissed: () => void
) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const pendingClose = useRef(false);
  function finishDismissal() {
    // Release modal inertness while the selected block is still held open,
    // so returning focus cannot collapse and re-expand the writing surface.
    dialog.current?.close();
    onDismissed();
  }
  function onDismiss() {
    if (pendingClose.current) return;
    pendingClose.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      finishDismissal();
    else setClosing(true);
  }
  // Effect callbacks read the latest handlers without reopening the dialog.
  const dismissFromEffect = useEffectEvent(onDismiss);
  const finishFromEffect = useEffectEvent(finishDismissal);
  useEffect(() => {
    if (!closing) return;
    let active = true;
    // Keep the modal and scroll lock through its exit before focus returns
    // to the unchanged article.
    Promise.all(
      (dialog.current?.getAnimations() ?? []).map((animation) =>
        animation.finished.catch(() => {})
      )
    ).then(() => {
      if (active) finishFromEffect();
    });
    return () => {
      active = false;
    };
  }, [closing]);
  useEffect(() => {
    const current = dialog.current;
    if (!current) return;
    const element: HTMLDialogElement = current;
    // Use the site’s wider-desktop gutter; narrower windows use a modal sheet.
    const wide = window.matchMedia('(min-width: 1440px)');
    function present() {
      const active = document.activeElement;
      const focused =
        active instanceof HTMLElement && element.contains(active)
          ? active
          : null;
      if (element.open) element.close();
      if (wide.matches) element.show();
      else element.showModal();
      element
        .querySelector('.studio-inspector-save')
        ?.setAttribute('aria-live', wide.matches ? 'off' : 'polite');
      (focused ?? element.querySelector<HTMLElement>('h2'))?.focus({
        preventScroll: true,
      });
    }
    function escape(event: KeyboardEvent) {
      // Modal Escape is handled by cancel. A desktop inspector also closes
      // when focus is in the article rather than inside the inspector.
      if (
        wide.matches &&
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('dialog:modal')
      ) {
        event.preventDefault();
        dismissFromEffect();
      }
    }
    const viewport = window.visualViewport;
    function fitKeyboard() {
      if (!viewport) return;
      element.style.setProperty(
        '--inspector-available-height',
        `${viewport.height}px`
      );
      element.style.setProperty(
        '--inspector-keyboard-inset',
        `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`
      );
    }
    fitKeyboard();
    viewport?.addEventListener('resize', fitKeyboard);
    viewport?.addEventListener('scroll', fitKeyboard);
    present();
    wide.addEventListener('change', present);
    document.addEventListener('keydown', escape);
    return () => {
      viewport?.removeEventListener('resize', fitKeyboard);
      viewport?.removeEventListener('scroll', fitKeyboard);
      wide.removeEventListener('change', present);
      document.removeEventListener('keydown', escape);
      element.close();
    };
  }, [host]);
  return { dialog, closing, onDismiss };
}
