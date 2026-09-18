'use client';

import { useEffect, useRef } from 'react';

/**
 * Fallback reveal for browsers without scroll-driven animations. It toggles
 * `data-reveal` on `.act` descendants once they enter the viewport; the CSS
 * in initiatives.css only reads that attribute when `animation-timeline`
 * is unsupported and motion is allowed.
 */
export default function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const supportsTimeline = CSS.supports('animation-timeline: view()');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (supportsTimeline || reduced) return;

    const acts = Array.from(root.querySelectorAll<HTMLElement>('.act'));
    for (const act of acts) act.dataset.reveal = 'out';
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.reveal = 'in';
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    for (const act of acts) observer.observe(act);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
