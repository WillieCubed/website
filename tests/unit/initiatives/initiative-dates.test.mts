import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDay, formatRange, isoDate } from '@/lib/initiatives/dates';
import { DateSchema } from '@/lib/initiatives/schema';

const day = (value: string) => DateSchema.parse(value);

test('a range within one month names the month once', () => {
  assert.equal(formatRange(day('2026-08-01'), day('2026-08-27')), 'Aug 1 – 27');
});

test('a range across months names both, with the year on request', () => {
  assert.equal(
    formatRange(day('2026-10-23'), day('2026-11-01'), true),
    'Oct 23 – Nov 1, 2026'
  );
});

test('calendar days keep their authored date in every format', () => {
  const date = day('2026-08-01');
  assert.equal(formatDay(date), 'Aug 1');
  assert.equal(isoDate(date), '2026-08-01');
});
