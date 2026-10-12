'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import SiteLink from '@/components/link/SiteLink';
import { ViewTransition } from '@/components/site/view-transition';

import type { PublicStatus } from '@/lib/status/types';

import WeatherPicture, { weatherLabel } from './WeatherPicture';
import './status.css';

export default function Status({
  initial,
  expanded = false,
}: {
  initial: PublicStatus;
  expanded?: boolean;
}) {
  const pathname = usePathname();
  const [data, setData] = useState(initial);
  const [now, setNow] = useState<Date>();
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const clock = setInterval(tick, 30000);
    const abort = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch('/api/status', {
          cache: 'no-store',
          signal: abort.signal,
        });
        if (response.ok) setData(await response.json());
      } catch {
        /* Keep the city available during a connection failure. */
      }
      tick();
    };
    const interval = setInterval(refresh, 900000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(clock);
      clearInterval(interval);
      abort.abort();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  if (!expanded && pathname === '/status') return null;
  const { location } = data;
  const weather =
    data.weather &&
    (!now ||
      Math.abs(now.getTime() - Date.parse(data.weather.observedAt)) < 3600000)
      ? data.weather
      : null;
  const time = now
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: location.timezone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(now)
    : '—';
  const zone = now
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: location.timezone,
        timeZoneName: 'short',
      })
        .formatToParts(now)
        .find((part) => part.type === 'timeZoneName')?.value
    : '';
  const city = (
    <ViewTransition name="status-city" share="status-detail" default="none">
      <span className="status-city">{location.city}</span>
    </ViewTransition>
  );
  const clock = (
    <ViewTransition name="status-clock" share="status-detail" default="none">
      <time dateTime={now?.toISOString()}>{time}</time>
    </ViewTransition>
  );
  const picture = (
    <ViewTransition name="status-weather" share="status-detail" default="none">
      <WeatherPicture weather={weather} />
    </ViewTransition>
  );
  const temperature = weather && (
    <ViewTransition
      name="status-temperature"
      share="status-detail"
      default="none"
    >
      <span className="temperature">
        {Math.round(weather.temperature)}°<span className="unit">F</span>
      </span>
    </ViewTransition>
  );
  if (!expanded)
    return (
      <SiteLink
        preview={false}
        prefetch={true}
        href="/status"
        className="microstatus"
        aria-label={`Willie's status in ${location.city}${weather ? `, ${Math.round(weather.temperature)} degrees Fahrenheit, ${weatherLabel(weather)}` : ''}`}
      >
        {city}
        {clock}
        {picture}
        {temperature}
      </SiteLink>
    );
  return (
    <>
      <section
        className="status-composition"
        aria-label="Willie's local time and weather"
      >
        <div className="status-place">
          <h1 className="status-heading">Willie is currently in {city}.</h1>
          <p className="clock">
            {clock}
            <span className="zone">{zone}</span>
          </p>
        </div>
        {picture}
        <div className="weather-reading">
          {temperature}
          <span className="condition">{weatherLabel(weather)}</span>
        </div>
      </section>
      <small className="attribution">
        <a href="https://open-meteo.com/">Weather by Open-Meteo</a>
      </small>
    </>
  );
}
