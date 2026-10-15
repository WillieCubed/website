'use client';

import { usePathname } from 'next/navigation';
import { type RefObject, useEffect, useRef, useState } from 'react';

import { fetchWithDeadline } from '@/lib/http/fetch';
import type { PublicLocation } from '@/lib/status/location';
import type { PublicStatus, WeatherObservation } from '@/lib/status/types';

export interface StatusController {
  data: PublicStatus;
  location: PublicLocation;
  weather: WeatherObservation | null;
  now: Date | undefined;
  time: string;
  zone: string | undefined;
  celsius: boolean;
  refreshing: boolean;
  selectedTimezone: string;
  deviceTimezone: string;
  weatherGroup: RefObject<HTMLDivElement | null>;
  toggleTemperature: () => void;
  setSelectedTimezone: (timezone: string) => void;
  visible: boolean;
}

function selectedZone(
  expanded: boolean,
  selected: string,
  local: string,
  device: string
): string {
  if (!expanded || selected === 'local') return local;
  return selected === 'device' ? device : selected;
}

export function useStatus(
  initial: PublicStatus,
  expanded: boolean
): StatusController {
  const pathname = usePathname();
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(true);
  const [celsius, setCelsius] = useState(false);
  const [now, setNow] = useState<Date>();
  const [selectedTimezone, setSelectedTimezone] = useState('local');
  const [deviceTimezone, setDeviceTimezone] = useState('UTC');
  const weatherGroup = useRef<HTMLDivElement>(null);
  const reaction = useRef<Animation | null>(null);
  const toggleTemperature = () => {
    setCelsius((value) => !value);
    reaction.current?.cancel();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const graphic = weatherGroup.current?.querySelector('.sky-glyph');
    if (!graphic) return;
    reaction.current = graphic.animate(
      [
        { translate: '0 0', scale: '1' },
        { translate: '0 2px', scale: '1.04 0.96', offset: 0.18 },
        { translate: '0 -10px', scale: '0.98 1.02', offset: 0.46 },
        { translate: '0 1px', scale: '1.02 0.98', offset: 0.78 },
        { translate: '0 0', scale: '1' },
      ],
      { duration: 460, easing: 'ease-in-out' }
    );
  };
  useEffect(() => {
    if (!expanded && pathname === '/status') return;
    setDeviceTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const tick = () => setNow(new Date());
    tick();
    const clock = setInterval(tick, 30000);
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
        if (response.ok) setData(await response.json());
      } catch {
        /* Keep the city available during a connection failure. */
      } finally {
        inFlight = false;
        if (!abort.signal.aborted) setRefreshing(false);
      }
      tick();
    };
    const interval = setInterval(refresh, 900000);
    document.addEventListener('visibilitychange', refresh);
    void refresh();
    return () => {
      reaction.current?.cancel();
      clearInterval(clock);
      clearInterval(interval);
      abort.abort();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [expanded, pathname]);
  const { location } = data;
  const weather =
    data.weather &&
    (!now ||
      Math.abs(now.getTime() - Date.parse(data.weather.observedAt)) < 3600000)
      ? data.weather
      : null;
  const timezone = selectedZone(
    expanded,
    selectedTimezone,
    location.timezone,
    deviceTimezone
  );
  const time = now
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(now)
    : '—';
  const zone = now
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short',
      })
        .formatToParts(now)
        .find((part) => part.type === 'timeZoneName')?.value
    : '';
  return {
    data,
    location,
    weather,
    now,
    time,
    zone,
    celsius,
    refreshing,
    selectedTimezone,
    deviceTimezone,
    weatherGroup,
    toggleTemperature,
    setSelectedTimezone,
    visible: expanded || pathname !== '/status',
  };
}
