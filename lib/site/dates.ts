import { site } from './identity';

/**
 * A calendar date the way the author saw it. Writing dates carry a Pacific
 * offset, and formatting them in the server's own zone shifted the day on a
 * UTC host.
 */
export function formatDate(
  date: Date | string | number,
  month: 'long' | 'short' = 'long'
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: site.timeZone,
    year: 'numeric',
    month,
    day: 'numeric',
  }).format(new Date(date));
}
