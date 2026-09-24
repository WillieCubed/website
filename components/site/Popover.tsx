'use client';

import { type ReactNode, useEffect, useId, useRef } from 'react';

import './site.css';

export default function Popover({
  label,
  trigger,
  children,
  triggerClassName,
  panelClassName,
  align = 'start',
}: {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  triggerClassName: string;
  panelClassName: string;
  align?: 'start' | 'end';
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function place() {
      const anchor = button.current?.getBoundingClientRect();
      const menu = panel.current;
      if (!anchor || !menu?.matches(':popover-open')) return;
      const width = Math.min(
        200,
        align === 'start' ? innerWidth - anchor.left - 16 : innerWidth - 32
      );
      menu.style.width = `${width}px`;
      menu.style.left = `${align === 'start' ? anchor.left : Math.max(16, anchor.right - width)}px`;
      menu.style.top = `${anchor.bottom + 8}px`;
    }
    const menu = panel.current;
    const toggle = (event: Event) => {
      const open = (event as ToggleEvent).newState === 'open';
      button.current?.setAttribute('aria-expanded', String(open));
      place();
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
        aria-expanded={false}
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
