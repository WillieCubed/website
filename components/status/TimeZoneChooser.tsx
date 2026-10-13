'use client';

import Popover from '@/components/site/Popover';

export default function TimeZoneChooser({
  current,
  localTimezone,
  deviceTimezone,
  city,
  zone,
  now,
  onChange,
}: {
  current: string;
  localTimezone: string;
  deviceTimezone: string;
  city: string;
  zone: string;
  now?: Date;
  onChange: (timezone: string) => void;
}) {
  const options = [
    { value: 'local', label: city, timezone: localTimezone },
    { value: 'device', label: 'Your time', timezone: deviceTimezone },
    { value: 'UTC', label: 'UTC', timezone: 'UTC' },
    {
      value: 'America/New_York',
      label: 'New York',
      timezone: 'America/New_York',
    },
    { value: 'Europe/London', label: 'London', timezone: 'Europe/London' },
    { value: 'Asia/Tokyo', label: 'Tokyo', timezone: 'Asia/Tokyo' },
  ];
  const selected = options.find((option) => option.value === current)!;
  return (
    <Popover
      label={`Change time zone, currently ${selected.label}, ${zone}`}
      trigger={zone || '—'}
      triggerClassName="zone"
      panelClassName="status-timezones"
      width={224}
    >
      <div
        className="status-timezones__options"
        role="group"
        aria-label="Time zone"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={current === option.value}
            onClick={(event) => {
              onChange(option.value);
              event.currentTarget
                .closest<HTMLElement>('[popover]')
                ?.hidePopover();
            }}
          >
            <span
              className={
                option.value === 'device'
                  ? 'status-timezones__visitor'
                  : undefined
              }
            >
              {option.label}
            </span>
            <span className="status-timezones__time">
              {now
                ? new Intl.DateTimeFormat('en-US', {
                    timeZone: option.timezone,
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(now)
                : '—'}
            </span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
