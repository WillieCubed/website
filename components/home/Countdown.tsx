import { connection } from 'next/server';

import { CountUp } from './CountUp';

// Midnight Pacific on the deadline, so the count matches Nevada's calendar.
const daysUntil = (date: string) =>
  Math.max(
    0,
    Math.ceil(
      (new Date(`${date}T00:00:00-08:00`).getTime() - Date.now()) / 86400000
    )
  );

interface DaysProps {
  deadline: string;
  animate?: boolean;
}

async function Days({ deadline, animate }: DaysProps) {
  // Reading the clock makes this a per-request hole in the static shell,
  // so the number is right on every visit instead of frozen at build time.
  await connection();
  return <CountUp end={daysUntil(deadline)} animate={animate} />;
}

/** Compute the current value on the server, before exposing the page. */
interface CountdownDaysProps {
  deadline: string;
  animate?: boolean;
}

export async function CountdownDays({
  deadline,
  animate = false,
}: CountdownDaysProps) {
  return <Days deadline={deadline} animate={animate} />;
}
