'use client';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import { statusLocation, weatherCondition } from '@/lib/status/model';

import { useStatus } from './StatusProvider';

export default function LocalConditions() {
  const { time, zone, weather, now, loaded } = useStatus();
  const condition = weather
    ? weatherCondition(weather.code, weather.isDay)
    : null;
  const age =
    weather && now
      ? Math.max(0, Math.floor((now - Date.parse(weather.observedAt)) / 60_000))
      : null;
  return (
    <section className="local-conditions" aria-labelledby="local-heading">
      <div className="local-conditions__top">
        <h2 id="local-heading">Around here</h2>
        <Icon
          name={condition?.icon ?? 'compass'}
          size={32}
          className="local-conditions__icon"
        />
      </div>
      <p className="local-conditions__city">{statusLocation.city}</p>
      <p className="local-conditions__clock">
        <span>{time ?? 'Pacific time'}</span>
        <span className="local-conditions__zone">{time && zone}</span>
      </p>
      <div className="local-conditions__weather" aria-live="polite">
        {weather && condition ? (
          <>
            <span>{weather.temperature}°F</span>
            <span>{condition.label}</span>
          </>
        ) : (
          <span>{loaded ? 'Weather unavailable' : 'Checking the sky…'}</span>
        )}
      </div>
      <div className="local-conditions__source">
        <span>
          {age === null
            ? 'City chosen by Willie'
            : `Conditions from ${age < 1 ? 'just now' : `${age} min ago`}`}
        </span>
        <SiteLink href="https://open-meteo.com/">Open-Meteo</SiteLink>
      </div>
    </section>
  );
}
