'use client';

import Link, { type LinkProps } from 'next/link';
import {
  type AnchorHTMLAttributes,
  type CSSProperties,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { entityKey } from '@/lib/entities/key';
import type { EntityCard } from '@/lib/entities/types';
import { isInternalHref } from '@/lib/site';

import LinkPreview from './LinkPreview';
import './link.css';
import { schemeVars } from './scheme';

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

export interface SiteLinkProps
  extends AnchorProps, Pick<LinkProps, 'prefetch' | 'scroll' | 'replace'> {
  href: string;
  /**
   * Show the hover card for in-site destinations. Turn it off on links that
   * already are a card (tiles, list items, navigation), where a second card
   * would only repeat what is under the pointer.
   */
  preview?: boolean;
}

const INTENT_DELAY = 250;
const LEAVE_GRACE = 120;
const CARD_WIDTH = 320;

let registryPromise: Promise<Map<string, EntityCard>> | null = null;

function loadRegistry(): Promise<Map<string, EntityCard>> {
  if (!registryPromise) {
    registryPromise = fetch('/entities.json')
      .then((response) => (response.ok ? response.json() : []))
      .then((cards: EntityCard[]) => new Map(cards.map((c) => [c.href, c])))
      .catch(() => {
        registryPromise = null;
        return new Map<string, EntityCard>();
      });
  }
  return registryPromise;
}

/**
 * The one link component for the site. In-site links get client-side
 * navigation and a hover card fed by the entity registry; everything else
 * renders as a plain anchor. See docs/links.md.
 */
export default function SiteLink({
  href,
  preview = true,
  children,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  prefetch,
  scroll,
  replace,
  ...rest
}: PropsWithChildren<SiteLinkProps>) {
  const internal = isInternalHref(href);
  const hash = href.startsWith('#');
  const wantsPreview = preview && internal && !hash;

  const anchorRef = useRef<HTMLAnchorElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const intentTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const [card, setCard] = useState<EntityCard | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const [open, setOpen] = useState(false);

  const clearTimers = () => {
    if (intentTimer.current) window.clearTimeout(intentTimer.current);
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    intentTimer.current = null;
    leaveTimer.current = null;
  };

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(CARD_WIDTH, window.innerWidth - 32);
    const left = Math.min(
      Math.max(16, rect.left),
      window.innerWidth - width - 16
    );
    const below = rect.bottom + 8;
    const fitsBelow = below + 220 <= window.innerHeight;
    setStyle(
      fitsBelow
        ? { left, top: below, width }
        : { left, bottom: window.innerHeight - rect.top + 8, width }
    );
  }, []);

  const show = useCallback(async () => {
    const registry = await loadRegistry();
    const found = registry.get(entityKey(href));
    if (!found) return;
    setCard(found);
    place();
    setOpen(true);
  }, [href, place]);

  const hide = useCallback(() => {
    clearTimers();
    setOpen(false);
  }, []);

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover || typeof popover.showPopover !== 'function') return;
    try {
      if (open && !popover.matches(':popover-open')) popover.showPopover();
      if (!open && popover.matches(':popover-open')) popover.hidePopover();
    } catch {
      // The element may already be in the requested state.
    }
  }, [open, card]);

  useEffect(() => {
    if (!open) return;
    const close = () => hide();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, hide]);

  useEffect(() => () => clearTimers(), []);

  const scheduleShow = () => {
    clearTimers();
    intentTimer.current = window.setTimeout(() => void show(), INTENT_DELAY);
  };
  const scheduleHide = () => {
    clearTimers();
    leaveTimer.current = window.setTimeout(() => setOpen(false), LEAVE_GRACE);
  };

  if (!internal) {
    return (
      <a
        href={href}
        rel={rest.rel ?? 'noopener'}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        {...rest}
      >
        {children}
      </a>
    );
  }

  const cardStyle = card?.brand
    ? { ...style, ...schemeVars(card.brand) }
    : style;

  return (
    <>
      <Link
        ref={anchorRef}
        href={href}
        prefetch={prefetch}
        scroll={scroll}
        replace={replace}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          if (wantsPreview && event.pointerType === 'mouse') scheduleShow();
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          if (wantsPreview) scheduleHide();
        }}
        onFocus={(event) => {
          onFocus?.(event);
          if (wantsPreview && event.currentTarget.matches(':focus-visible')) {
            scheduleShow();
          }
        }}
        onBlur={(event) => {
          onBlur?.(event);
          if (wantsPreview) hide();
        }}
        onPointerDown={hide}
        {...rest}
      >
        {children}
      </Link>
      {wantsPreview && card && (
        <LinkPreview card={card} style={cardStyle} popoverRef={popoverRef} />
      )}
    </>
  );
}
