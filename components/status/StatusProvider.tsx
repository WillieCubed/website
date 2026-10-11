'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import {
  type Weather,
  statusLocation,
  usableWeather,
} from '@/lib/status/model';

const StatusContext = createContext<{
  now: number | null;
  weather: Weather | null;
  loaded: boolean;
}>({ now: null, weather: null, loaded: false });

export function StatusProvider({ children }: React.PropsWithChildren) {
  const [now, setNow] = useState<number | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const tick = () => setNow(Date.now());
    async function refresh() {
      if (document.hidden) return;
      tick();
      try {
        const response = await fetch('/api/status', {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) setWeather(data.weather);
      } catch {
        // Keep a still-fresh snapshot through a failed refresh.
      } finally {
        if (!controller.signal.aborted) setLoaded(true);
      }
    }
    tick();
    void refresh();
    const minute = window.setInterval(tick, 60_000);
    const update = window.setInterval(refresh, 15 * 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      window.clearInterval(minute);
      window.clearInterval(update);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return (
    <StatusContext
      value={{
        now,
        weather: now === null ? null : usableWeather(weather, now),
        loaded,
      }}
    >
      {children}
    </StatusContext>
  );
}

export function useStatus() {
  const value = useContext(StatusContext);
  const time =
    value.now === null
      ? null
      : new Intl.DateTimeFormat('en-US', {
          timeZone: statusLocation.timeZone,
          hour: 'numeric',
          minute: '2-digit',
        }).format(value.now);
  const zone =
    value.now === null
      ? 'Pacific time'
      : new Intl.DateTimeFormat('en-US', {
          timeZone: statusLocation.timeZone,
          timeZoneName: 'short',
        })
          .formatToParts(value.now)
          .find((part) => part.type === 'timeZoneName')?.value;
  return { ...value, time, zone };
}
