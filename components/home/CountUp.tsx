/** A truthful, stable value in both server HTML and the enhanced page. */
interface CountUpProps {
  end: number;
  animate?: boolean;
}

export function CountUp({ end }: CountUpProps) {
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{end}</span>;
}
