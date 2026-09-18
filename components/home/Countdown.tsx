import { connection } from 'next/server';
import { Suspense } from 'react';

import { CountUp } from './CountUp';

// Midnight Pacific on the deadline, so the count matches Nevada's calendar.
const daysUntil = (date: string) =>
  Math.max(
    0,
    Math.ceil(
      (new Date(`${date}T00:00:00-08:00`).getTime() - Date.now()) / 86400000
    )
  );

async function Days({
  deadline,
  animate,
}: {
  deadline: string;
  animate?: boolean;
}) {
  // Reading the clock makes this a per-request hole in the static shell,
  // so the number is right on every visit instead of frozen at build time.
  await connection();
  return <CountUp end={daysUntil(deadline)} animate={animate} />;
}

/** The number of days left before `deadline`, streamed in at request time. */
export function CountdownDays({
  deadline,
  animate = false,
}: {
  deadline: string;
  animate?: boolean;
}) {
  return (
    <Suspense fallback={<span>…</span>}>
      <Days deadline={deadline} animate={animate} />
    </Suspense>
  );
}
