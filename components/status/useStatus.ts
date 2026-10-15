'use client';

import { useEffect, useState } from 'react';

import { fetchWithDeadline } from '@/lib/http/fetch';
import type { PublicStatus } from '@/lib/status/types';

interface StatusSnapshot {
  data: PublicStatus;
  refreshing: boolean;
}

/** Retain the last available public snapshot while refreshes are suspended or fail. */
export function useStatusSnapshot(
  initial: PublicStatus,
  active: boolean
): StatusSnapshot {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(true);
  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      setRefreshing(true);
      try {
        const response = await fetchWithDeadline('/api/status', {
          cache: 'no-store',
          signal: abort.signal,
        });
        if (response.ok) {
          const next: PublicStatus = await response.json();
          if (!abort.signal.aborted) setData(next);
        }
      } catch {
        /* Keep the city available during a connection failure. */
      } finally {
        inFlight = false;
        if (!abort.signal.aborted) setRefreshing(false);
      }
    };
    const interval = setInterval(refresh, 900000);
    document.addEventListener('visibilitychange', refresh);
    void refresh();
    return () => {
      clearInterval(interval);
      abort.abort();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [active]);
  return { data, refreshing };
}

/** One time source for the clock and the age of the displayed weather. */
export function useStatusClock(active: boolean): Date | undefined {
  const [now, setNow] = useState<Date>();
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(new Date());
    tick();
    const clock = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(clock);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active]);
  return now;
}
