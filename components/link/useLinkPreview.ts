'use client';

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { entityKey } from '@/lib/entities/key';
import type { EntityCard } from '@/lib/entities/types';
import { fetchWithDeadline } from '@/lib/http/fetch';

const INTENT_DELAY = 250;
// Long enough for a pointer to cross the 8px gap between the link and the
// card, diagonally from a long link, without the card closing under it.
const LEAVE_GRACE = 200;
const CARD_WIDTH = 320;

let registryPromise: Promise<Map<string, EntityCard>> | null = null;

function loadRegistry(): Promise<Map<string, EntityCard>> {
  if (!registryPromise) {
    registryPromise = fetchWithDeadline('/entities.json')
      .then((response) => {
        // A failed response goes through the catch below like a network
        // error, so one bad deploy or cold start does not leave the whole
        // visit without cards.
        if (!response.ok) throw new Error(`/entities.json ${response.status}`);
        return response.json() as Promise<EntityCard[]>;
      })
      .then((cards) => new Map(cards.map((c) => [c.href, c])))
      .catch(() => {
        registryPromise = null;
        return new Map<string, EntityCard>();
      });
  }
  return registryPromise;
}

/** Owns hover intent, fetched preview data, placement and popover lifetime. */
export function useLinkPreview(href: string) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const intentTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  // Bumped whenever intent ends. The first show waits on the registry fetch,
  // and a fetch that resolves after the pointer left or focus moved on must
  // not open the card.
  const intent = useRef(0);
  const [card, setCard] = useState<EntityCard | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const [open, setOpen] = useState(false);

  const clearTimers = () => {
    if (intentTimer.current !== null) window.clearTimeout(intentTimer.current);
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
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
    const token = intent.current;
    const registry = await loadRegistry();
    if (token !== intent.current) return;
    const found = registry.get(entityKey(href));
    if (!found) return;
    setCard(found);
    place();
    setOpen(true);
  }, [href, place]);

  const hide = useCallback(() => {
    intent.current += 1;
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

  useEffect(
    () => () => {
      intent.current += 1;
      clearTimers();
    },
    []
  );

  const scheduleShow = () => {
    clearTimers();
    intentTimer.current = window.setTimeout(() => void show(), INTENT_DELAY);
  };
  const scheduleHide = () => {
    intent.current += 1;
    clearTimers();
    leaveTimer.current = window.setTimeout(() => setOpen(false), LEAVE_GRACE);
  };

  return {
    anchorRef,
    popoverRef,
    card,
    style,
    clearTimers,
    scheduleShow,
    scheduleHide,
    hide,
  };
}
