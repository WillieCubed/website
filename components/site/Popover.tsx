'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import './site.css';

export default function Popover({
  label,
  current = false,
  trigger,
  children,
  triggerClassName,
  panelClassName,
  align = 'start',
}: {
  label: string;
  current?: boolean;
  trigger: ReactNode;
  children: ReactNode;
  triggerClassName: string;
  panelClassName: string;
  align?: 'start' | 'end';
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function place() {
      const anchor = button.current?.getBoundingClientRect();
      const menu = panel.current;
      if (!anchor || !menu?.matches(':popover-open')) return;
      const horizontalInset = 16;
      const verticalInset = 18;
      const gap = 8;
      const width = Math.min(240, innerWidth - 32);
      const preferredLeft =
        align === 'start' ? anchor.left : anchor.right - width;
      const left = Math.min(
        Math.max(horizontalInset, preferredLeft),
        innerWidth - width - horizontalInset
      );
      const belowSpace = Math.max(
        0,
        innerHeight - verticalInset - anchor.bottom - gap
      );
      const aboveSpace = Math.max(0, anchor.top - verticalInset - gap);
      const desiredHeight = menu.scrollHeight;
      const placeAbove = desiredHeight > belowSpace && aboveSpace > belowSpace;
      const availableHeight = placeAbove ? aboveSpace : belowSpace;
      menu.style.width = `${width}px`;
      menu.style.left = `${left}px`;
      menu.style.maxHeight = `${availableHeight}px`;
      menu.style.top = placeAbove
        ? `${anchor.top - gap - Math.min(desiredHeight, availableHeight)}px`
        : `${anchor.bottom + gap}px`;
    }
    const menu = panel.current;
    const toggle = (event: Event) => {
      const open = (event as ToggleEvent).newState === 'open';
      setOpen(open);
      place();
      if (open) {
        menu?.querySelector<HTMLElement>('a, button, [tabindex="0"]')?.focus();
      } else if (menu?.contains(document.activeElement)) {
        button.current?.focus();
      }
    };
    menu?.addEventListener('toggle', toggle);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    return () => {
      menu?.removeEventListener('toggle', toggle);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
    };
  }, [align]);
  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        className={triggerClassName}
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
          if (event.target instanceof Element && event.target.closest('a'))
            panel.current?.hidePopover();
        }}
      >
        {children}
      </div>
    </>
  );
}
