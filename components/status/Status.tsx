'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import { ViewTransition } from '@/components/site/view-transition';

import { useHydrated } from '@/lib/dom/hydrated';
import type { PublicLocation } from '@/lib/status/location';
import type { PublicStatus, WeatherObservation } from '@/lib/status/types';

import TimeZoneChooser from './TimeZoneChooser';
import WeatherPicture, { weatherLabel } from './WeatherPicture';
import './status.css';
import { useStatusClock, useStatusSnapshot } from './useStatus';

interface TemperatureProps {
  weather: WeatherObservation | null;
  celsius: boolean;
}

function Temperature({ weather, celsius }: TemperatureProps) {
  if (!weather) return null;
  return (
    <ViewTransition
      name="status-temperature"
      share="status-detail"
      default="none"
    >
      <span className="temperature">
        {Math.round(
          celsius ? ((weather.temperature - 32) * 5) / 9 : weather.temperature
        )}
        °<span className="unit">{celsius ? 'C' : 'F'}</span>
      </span>
    </ViewTransition>
  );
}

interface StatusProps {
  initial: PublicStatus;
  expanded?: boolean;
}

export default function Status({ initial, expanded = false }: StatusProps) {
  const pathname = usePathname();
  const visible = expanded || pathname !== '/status';
  const { data, refreshing } = useStatusSnapshot(initial, visible);
  const now = useStatusClock(visible);
  if (!visible) return null;
  const { location } = data;
  const weather =
    data.weather &&
    (!now ||
      Math.abs(now.getTime() - Date.parse(data.weather.observedAt)) < 3600000)
      ? data.weather
      : null;
  if (!expanded)
    return (
      <CompactStatus
        location={location}
        weather={weather}
        unavailable={data.unavailable}
        now={now}
      />
    );
  return (
    <StatusDetails
      data={data}
      weather={weather}
      now={now}
      refreshing={refreshing}
    />
  );
}

interface StatusCityProps {
  city: string;
}

function StatusCity({ city }: StatusCityProps) {
  return (
    <ViewTransition name="status-city" share="status-detail" default="none">
      <span className="status-city">{city}</span>
    </ViewTransition>
  );
}

interface StatusClockProps {
  now?: Date;
  timezone: string;
}

function StatusClock({ now, timezone }: StatusClockProps) {
  const time = now
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(now)
    : '—';
  return (
    <ViewTransition name="status-clock" share="status-detail" default="none">
      <time dateTime={now?.toISOString()}>{time}</time>
    </ViewTransition>
  );
}

interface StatusWeatherPictureProps {
  weather: WeatherObservation | null;
  compact?: boolean;
}

function StatusWeatherPicture({
  weather,
  compact = false,
}: StatusWeatherPictureProps) {
  return (
    <ViewTransition name="status-weather" share="status-detail" default="none">
      <WeatherPicture weather={weather} compact={compact} />
    </ViewTransition>
  );
}

interface CompactStatusProps {
  location: PublicLocation;
  weather: WeatherObservation | null;
  unavailable?: boolean;
  now?: Date;
}
function CompactStatus({
  location,
  weather,
  unavailable,
  now,
}: CompactStatusProps) {
  return (
    <SiteLink
      preview={false}
      href="/status"
      className="microstatus"
      aria-label={
        unavailable
          ? 'Current status unavailable'
          : `Willie's status in ${location.city}${weather ? `, ${Math.round(weather.temperature)} degrees Fahrenheit, ${weatherLabel(weather)}` : ''}`
      }
    >
      <span className="microstatus-place">
        <Icon name="map-pin" />
        {unavailable ? (
          'Status unavailable'
        ) : (
          <StatusCity city={location.city} />
        )}
      </span>
      <span
        className="microstatus-clock"
        style={unavailable ? { visibility: 'hidden' } : undefined}
      >
        <Icon name="clock" />
        <StatusClock now={now} timezone={location.timezone} />
      </span>
      {weather && (
        <span className="microstatus-weather">
          <StatusWeatherPicture weather={weather} compact />
          <Temperature weather={weather} celsius={false} />
        </span>
      )}
    </SiteLink>
  );
}

interface StatusDetailsProps {
  data: PublicStatus;
  weather: WeatherObservation | null;
  now?: Date;
  refreshing: boolean;
}

function StatusDetails({ data, weather, now, refreshing }: StatusDetailsProps) {
  return (
    <section
      className="status-composition"
      aria-label="Willie's location, time, and weather"
    >
      <div className="status-place">
        <h1 className="status-heading">
          {data.unavailable ? (
            'Willie’s current location is unavailable.'
          ) : (
            <>
              Willie is currently in <StatusCity city={data.location.city} />.
            </>
          )}
        </h1>
        <ExpandedClock
          location={data.location}
          now={now}
          unavailable={data.unavailable}
        />
      </div>
      <ExpandedWeather weather={weather} refreshing={refreshing} />
    </section>
  );
}

interface ExpandedClockProps {
  location: PublicLocation;
  now?: Date;
  unavailable?: boolean;
}

function ExpandedClock({ location, now, unavailable }: ExpandedClockProps) {
  const [selectedTimezone, setSelectedTimezone] = useState('local');
  const [deviceTimezone, setDeviceTimezone] = useState('UTC');
  useEffect(() => {
    setDeviceTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  const timezone =
    selectedTimezone === 'local'
      ? location.timezone
      : selectedTimezone === 'device'
        ? deviceTimezone
        : selectedTimezone;
  const zone = now
    ? (new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short',
      })
        .formatToParts(now)
        .find((part) => part.type === 'timeZoneName')?.value ?? '')
    : '';
  return (
    <div
      className="clock"
      style={unavailable ? { visibility: 'hidden' } : undefined}
    >
      <StatusClock now={now} timezone={timezone} />
      <TimeZoneChooser
        current={selectedTimezone}
        localTimezone={location.timezone}
        deviceTimezone={deviceTimezone}
        city={location.city}
        zone={zone}
        now={now}
        onChange={setSelectedTimezone}
      />
    </div>
  );
}

interface ExpandedWeatherProps {
  weather: WeatherObservation | null;
  refreshing: boolean;
}

function ExpandedWeather({ weather, refreshing }: ExpandedWeatherProps) {
  const hydrated = useHydrated();
  const [celsius, setCelsius] = useState(false);
  const weatherGroup = useRef<HTMLDivElement>(null);
  const reaction = useRef<Animation | null>(null);
  useEffect(() => () => reaction.current?.cancel(), []);
  function toggleTemperature() {
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
  }
  return (
    <div ref={weatherGroup} className="status-weather-group">
      <StatusWeatherPicture weather={weather} />
      {weather ? (
        <button
          type="button"
          className="weather-reading"
          disabled={!hydrated}
          onClick={toggleTemperature}
          aria-label={`Show temperature in degrees ${celsius ? 'Fahrenheit' : 'Celsius'}`}
          title={`Switch to °${celsius ? 'F' : 'C'}`}
        >
          <Temperature weather={weather} celsius={celsius} />
          <span className="condition">{weatherLabel(weather)}</span>
        </button>
      ) : (
        <div className="weather-reading">
          {refreshing ? (
            <>
              <span className="condition weather-pending" role="status">
                Loading weather…
              </span>
              <noscript>
                <span className="condition">Weather unavailable</span>
              </noscript>
            </>
          ) : (
            <span className="condition">{weatherLabel(weather)}</span>
          )}
        </div>
      )}
      <small className="attribution">
        <a href="https://open-meteo.com/">Weather by Open-Meteo</a>
      </small>
    </div>
  );
}
