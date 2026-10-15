'use client';

import type { ReactNode } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import { ViewTransition } from '@/components/site/view-transition';

import { useHydrated } from '@/lib/dom/hydrated';
import type { PublicLocation } from '@/lib/status/location';
import type { PublicStatus, WeatherObservation } from '@/lib/status/types';

import TimeZoneChooser from './TimeZoneChooser';
import WeatherPicture, { weatherLabel } from './WeatherPicture';
import './status.css';
import { type StatusController, useStatus } from './useStatus';

function Temperature({
  weather,
  celsius,
}: {
  weather: WeatherObservation | null;
  celsius: boolean;
}) {
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

export default function Status({
  initial,
  expanded = false,
}: {
  initial: PublicStatus;
  expanded?: boolean;
}) {
  const view = useStatus(initial, expanded);
  if (!view.visible) return null;
  const { location, weather, now, time } = view;
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
      <WeatherPicture weather={weather} compact={!expanded} />
    </ViewTransition>
  );
  const temperature = (
    <Temperature weather={weather} celsius={expanded && view.celsius} />
  );
  if (!expanded)
    return (
      <CompactStatus
        location={location}
        weather={weather}
        unavailable={view.data.unavailable}
        city={city}
        clock={clock}
        picture={picture}
        temperature={temperature}
      />
    );
  return (
    <StatusDetails
      view={view}
      city={city}
      clock={clock}
      picture={picture}
      temperature={temperature}
    />
  );
}

interface CompactStatusProps {
  location: PublicLocation;
  weather: WeatherObservation | null;
  unavailable?: boolean;
  city: ReactNode;
  clock: ReactNode;
  picture: ReactNode;
  temperature: ReactNode;
}
function CompactStatus({
  location,
  weather,
  unavailable,
  city,
  clock,
  picture,
  temperature,
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
        {unavailable ? 'Status unavailable' : city}
      </span>
      <span
        className="microstatus-clock"
        style={unavailable ? { visibility: 'hidden' } : undefined}
      >
        <Icon name="clock" />
        {clock}
      </span>
      {weather && (
        <span className="microstatus-weather">
          {picture}
          {temperature}
        </span>
      )}
    </SiteLink>
  );
}

function StatusDetails({
  view,
  city,
  clock,
  picture,
  temperature,
}: {
  view: StatusController;
  city: ReactNode;
  clock: ReactNode;
  picture: ReactNode;
  temperature: ReactNode;
}) {
  const hydrated = useHydrated();
  const {
    location,
    selectedTimezone,
    deviceTimezone,
    zone,
    now,
    weatherGroup,
    weather,
    celsius,
    refreshing,
    toggleTemperature,
    setSelectedTimezone,
  } = view;
  return (
    <>
      <section
        className="status-composition"
        aria-label="Willie's location, time, and weather"
      >
        <div className="status-place">
          <h1 className="status-heading">
            {view.data.unavailable ? (
              'Willie’s current location is unavailable.'
            ) : (
              <>Willie is currently in {city}.</>
            )}
          </h1>
          <div
            className="clock"
            style={view.data.unavailable ? { visibility: 'hidden' } : undefined}
          >
            {clock}
            <TimeZoneChooser
              current={selectedTimezone}
              localTimezone={location.timezone}
              deviceTimezone={deviceTimezone}
              city={location.city}
              zone={zone || ''}
              now={now}
              onChange={setSelectedTimezone}
            />
          </div>
        </div>
        <div ref={weatherGroup} className="status-weather-group">
          {picture}
          {weather ? (
            <button
              type="button"
              className="weather-reading"
              disabled={!hydrated}
              onClick={toggleTemperature}
              aria-label={`Show temperature in degrees ${celsius ? 'Fahrenheit' : 'Celsius'}`}
              title={`Switch to °${celsius ? 'F' : 'C'}`}
            >
              {temperature}
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
      </section>
    </>
  );
}
