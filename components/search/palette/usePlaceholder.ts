'use client';

import { useEffect, useState } from 'react';

import { EGG_HINTS } from '@/lib/search/palette/commands';

const PLACEHOLDER = 'Search, or jump somewhere';
/** How often the placeholder moves on, and how many turns a hint waits. */
const HINT_TICK_MS = 3500;
const HINT_EVERY = 3;
/** Cycles the placeholder through a hint now and then while it shows. */
export function usePlaceholder(active: boolean): string {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), HINT_TICK_MS);
    return () => window.clearInterval(id);
  }, [active]);
  if (tick % HINT_EVERY !== HINT_EVERY - 1) return PLACEHOLDER;
  const hint = EGG_HINTS[Math.floor(tick / HINT_EVERY) % EGG_HINTS.length];
  return `try: ${hint}`;
}
