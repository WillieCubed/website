'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { type AnchorBounds, positionPopover } from './popover-position';
import './site.css';

interface PopoverProps {
  label: string;
  current?: boolean;
  trigger: ReactNode;
  children: ReactNode;
  triggerClassName: string;
  panelClassName: string;
  align?: 'start' | 'end';
  placement?: 'default' | 'breadcrumb';
  width?: number;
  disabled?: boolean;
  anchorRect?: () => AnchorBounds | null;
}

export default function Popover({
  label,
  current = false,
  trigger,
  children,
  triggerClassName,
  panelClassName,
  align = 'start',
  placement = 'default',
  width: preferredWidth = 240,
  disabled = false,
  anchorRect,
}: PopoverProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function place() {
      const anchor = anchorRect?.() ?? button.current?.getBoundingClientRect();
      const menu = panel.current;
      if (!anchor || !menu?.matches(':popover-open')) return;
      positionPopover(menu, button.current, anchor, {
        align,
        placement,
        preferredWidth,
      });
    }
    const menu = panel.current;
    const toggle = (event: Event) => {
      const open = (event as ToggleEvent).newState === 'open';
      setOpen(open);
      place();
      if (open) {
        menu
          ?.querySelector<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'
          )
          ?.focus();
      } else if (menu?.contains(document.activeElement)) {
        button.current?.focus();
      }
    };
    menu?.addEventListener('toggle', toggle);
    // The breadcrumb fitter moves the anchor after the resize event by
    // replacing the name with the cube or folding earlier crumbs.
    const layout = new MutationObserver(place);
    const header = button.current?.closest('header');
    if (placement === 'breadcrumb' && header) {
      layout.observe(header, {
        attributes: true,
        attributeFilter: ['data-compact', 'data-folded'],
      });
    }
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    return () => {
      menu?.removeEventListener('toggle', toggle);
      layout.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
    };
  }, [align, placement, preferredWidth, anchorRect]);
  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        popoverTarget={id}
        className={`site-control ${triggerClassName}`}
        aria-label={label}
        aria-current={current ? 'page' : undefined}
        aria-controls={id}
        aria-expanded={open}
      >
        {trigger}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        className={`site-popover ${panelClassName}`}
        onClick={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('a, [data-popover-dismiss]')
          )
            panel.current?.hidePopover();
        }}
      >
        {children}
      </div>
    </>
  );
}
