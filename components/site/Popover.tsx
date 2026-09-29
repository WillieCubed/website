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
  placement = 'default',
}: {
  label: string;
  current?: boolean;
  trigger: ReactNode;
  children: ReactNode;
  triggerClassName: string;
  panelClassName: string;
  align?: 'start' | 'end';
  placement?: 'default' | 'breadcrumb';
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
      const breadcrumb = placement === 'breadcrumb';
      const gap = breadcrumb ? 4 : 8;
      const anchorTop = anchor.top + (breadcrumb ? 8 : 0);
      const anchorBottom = anchor.bottom - (breadcrumb ? 8 : 0);
      if (breadcrumb) menu.style.width = '';
      const menuRect = menu.getBoundingClientRect();
      const width = breadcrumb
        ? menuRect.width
        : Math.min(240, innerWidth - 32);
      let preferredLeft =
        align === 'start' ? anchor.left : anchor.right - width;
      if (breadcrumb) {
        const anchorLabel = button.current?.querySelector<HTMLElement>(
          '.site-breadcrumb-menu__label'
        );
        const firstLink = menu.querySelector<HTMLElement>(
          '.site-breadcrumb-menu__link'
        );
        const linkTextInset = firstLink
          ? firstLink.getBoundingClientRect().left -
            menuRect.left +
            parseFloat(getComputedStyle(firstLink).paddingLeft)
          : 0;
        preferredLeft =
          (anchorLabel?.getBoundingClientRect().left ?? anchor.left) -
          linkTextInset;
      }
      const left = Math.min(
        Math.max(horizontalInset, preferredLeft),
        innerWidth - width - horizontalInset
      );
      // The menu can cross the Search control at narrow header widths.
      const search = breadcrumb
        ? button.current
            ?.closest('header')
            ?.querySelector<HTMLElement>('.palette-trigger--compact')
            ?.getBoundingClientRect()
        : undefined;
      const belowTop = Math.max(
        anchorBottom + gap,
        search && left < search.right && left + width > search.left
          ? search.bottom
          : 0
      );
      const belowSpace = Math.max(0, innerHeight - verticalInset - belowTop);
      const aboveSpace = Math.max(0, anchorTop - verticalInset - gap);
      const desiredHeight = menu.scrollHeight;
      const placeAbove = desiredHeight > belowSpace && aboveSpace > belowSpace;
      const availableHeight = placeAbove ? aboveSpace : belowSpace;
      if (!breadcrumb) menu.style.width = `${width}px`;
      menu.style.left = `${left}px`;
      menu.style.maxHeight = `${availableHeight}px`;
      menu.style.top = placeAbove
        ? `${anchorTop - gap - Math.min(desiredHeight, availableHeight)}px`
        : `${belowTop}px`;
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
  }, [align, placement]);
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
