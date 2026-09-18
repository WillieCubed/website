'use client';

import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from './HomeContext';

/**
 * A number that counts up from zero the first time it scrolls into view.
 * Without `animate`, or under reduced motion, it just shows the number.
 */
export function CountUp({
  end,
  animate = false,
}: {
  end: number;
  animate?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(end);

  useEffect(() => {
    const el = ref.current;
    if (!animate || !el || !end || prefersReducedMotion()) return;
    const observer = new IntersectionObserver(
      (items, obs) => {
        if (!items.some((item) => item.isIntersecting)) return;
        obs.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / 900);
          setValue(Math.round(end * (1 - (1 - t) ** 3)));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.6 }
    );
    observer.observe(el.closest('.count, .d-count') ?? el);
    return () => observer.disconnect();
  }, [animate, end]);

  return <span ref={ref}>{value}</span>;
}
