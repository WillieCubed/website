'use client';

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import './references.css';

export interface RefMarkProps {
  id: string;
  index: string | number;
  kind?: 'note' | 'link';
  content: string;
  href?: string;
}

const CARD_WIDTH = 360;

/**
 * The superscript number on a referenced passage. Pointing at it or
 * focusing it opens the reference beside it; clicking it jumps to the entry
 * in the list at the end of the page.
 */
export function RefMark({
  id,
  index,
  kind = 'note',
  content,
  href,
}: RefMarkProps) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const leaveTimer = useRef<number | null>(null);
  const number = Number(index);
  const popoverId = `ref-popover-${id}`;

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(CARD_WIDTH, window.innerWidth - 32);
    const left = Math.min(
      Math.max(16, rect.left - 12),
      window.innerWidth - width - 16
    );
    const fitsBelow = rect.bottom + 8 + 160 <= window.innerHeight;
    setStyle(
      fitsBelow
        ? { left, top: rect.bottom + 8, width }
        : { left, bottom: window.innerHeight - rect.top + 8, width }
    );
  }, []);

  const show = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    place();
    setOpen(true);
  };
  const hide = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover || typeof popover.showPopover !== 'function') return;
    try {
      if (open && !popover.matches(':popover-open')) popover.showPopover();
      if (!open && popover.matches(':popover-open')) popover.hidePopover();
    } catch {
      // Already in the requested state.
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const host = href ? safeHost(href) : undefined;

  return (
    <>
      <a
        ref={anchorRef}
        id={`ref-mark-${id}`}
        href={`#ref-${id}`}
        className="ref-mark"
        aria-label={`Reference ${number}`}
        aria-describedby={popoverId}
        aria-expanded={open}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') show();
        }}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={() => setOpen(false)}
      >
        {number}
      </a>
      <span
        ref={popoverRef}
        id={popoverId}
        popover="manual"
        role="note"
        className="ref-popover"
        style={style}
        onPointerEnter={() => {
          if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
        }}
        onPointerLeave={hide}
      >
        <span className="ref-popover__num">{number}</span>
        {kind === 'link' && href ? (
          <a href={href} rel="noopener" className="link-animated">
            {content}
          </a>
        ) : (
          content
        )}
        {host && <span className="ref-popover__host">{host}</span>}
      </span>
    </>
  );
}

function safeHost(href: string): string | undefined {
  try {
    return new URL(href, 'https://willie.page').hostname;
  } catch {
    return undefined;
  }
}

export default RefMark;
