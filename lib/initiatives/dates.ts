/*
 * Initiative and project dates are calendar days anchored to local midnight
 * (see DateSchema), so they format in the process's own zone. Formatting them
 * in the site's zone would move every day back on a UTC host.
 */

const monthDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});
const dayOnly = new Intl.DateTimeFormat('en-US', { day: 'numeric' });

const sameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/** "Aug 1 – Sep 27" or "Oct 23 – Nov 1, 2026" depending on what differs. */
export function formatRange(starts: Date, ends: Date, withYear = false) {
  const year = withYear ? `, ${ends.getFullYear()}` : '';
  const end = sameMonth(starts, ends) ? dayOnly : monthDay;
  return `${monthDay.format(starts)} – ${end.format(ends)}${year}`;
}

/** "Aug 1". */
export function formatDay(date: Date) {
  return monthDay.format(date);
}

/** "2026-08-01", for `dateTime` attributes and structured data. */
export function isoDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
