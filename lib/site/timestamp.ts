import { site } from '@/lib/site/identity';

/**
 * A date the way the hand-written posts spell it: local to the site's time
 * zone with a numeric offset, such as `2026-09-27T13:05-0700`. YAML reads
 * that as a string rather than a timestamp, the same as the posts Willie
 * writes, and the writings loader parses both.
 */
export function siteTimestamp(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: site.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value])
  );
  const offset = parts.timeZoneName.replace('GMT', '').replace(':', '');
  const seconds = parts.second === '00' ? '' : `:${parts.second}`;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}${seconds}${offset || '+0000'}`;
}
