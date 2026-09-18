import { format, isSameMonth, isSameYear } from 'date-fns';

/** "Aug 1 – Sep 27" or "Oct 23 – Nov 1, 2026" depending on what differs. */
export function formatRange(starts: Date, ends: Date, withYear = false) {
  const year = withYear ? `, ${format(ends, 'yyyy')}` : '';
  if (isSameMonth(starts, ends) && isSameYear(starts, ends)) {
    return `${format(starts, 'MMM d')} – ${format(ends, 'd')}${year}`;
  }
  return `${format(starts, 'MMM d')} – ${format(ends, 'MMM d')}${year}`;
}

export function formatDay(date: Date) {
  return format(date, 'MMM d');
}

export function isoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}
