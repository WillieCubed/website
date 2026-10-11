'use client';

import { usePathname } from 'next/navigation';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import { statusLocation, weatherCondition } from '@/lib/status/model';

import { useStatus } from './StatusProvider';
import './status.css';

export default function Microstatus() {
  const { time, weather } = useStatus();
  const path = usePathname();
  if (path === '/status') return null;
  return (
    <SiteLink
      href="/status"
      preview={false}
      className="microstatus"
      data-footer-status
    >
      <span className="sr-only">Current status: </span>
      <span>{statusLocation.city}</span>
      <span className="microstatus__time">{time ?? 'Pacific time'}</span>
      {weather && (
        <span className="microstatus__weather">
          <Icon name={weatherCondition(weather.code, weather.isDay).icon} />
          <span className="sr-only">
            {weatherCondition(weather.code, weather.isDay).label},{' '}
          </span>
          <span>{weather.temperature}°F</span>
        </span>
      )}
      <Icon name="arrow-right" className="microstatus__arrow" />
    </SiteLink>
  );
}
