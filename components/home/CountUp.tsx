/** A truthful, stable value in both server HTML and the enhanced page. */
export function CountUp({ end }: { end: number; animate?: boolean }) {
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{end}</span>;
}
