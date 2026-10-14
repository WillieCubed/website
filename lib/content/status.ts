/** Explicit status wins; an end date includes its entire local calendar day. */
export function statusFromDates<T extends string>(
  explicit: T | undefined,
  starts: Date | undefined,
  ends: Date | undefined,
  now: Date
): T | 'planned' | 'active' | 'complete' {
  if (explicit) return explicit;
  if (starts && now < starts) return 'planned';
  if (ends) {
    const lastMoment = new Date(ends);
    lastMoment.setHours(23, 59, 59, 999);
    if (now > lastMoment) return 'complete';
  }
  return starts ? 'active' : 'planned';
}
