import type { CSSProperties } from 'react';

import type { KitUsage } from '@/lib/brand/kit';

/**
 * A logo file inside its clear space, drawn from the kit's own measurements.
 * The tinted band is x wide on every side. Four x squares stand beside the
 * cube to show that x is a quarter of its height, and in a lockup the gap
 * between cube and name is marked as the same x.
 */
export default function ClearSpace({
  src,
  usage,
  gap = false,
}: {
  src: string;
  usage: KitUsage;
  /** Mark the lockup's cube-to-name gap as x. */
  gap?: boolean;
}) {
  const { width: w, height: h, cube, clearSpace } = usage;
  if (!cube || !clearSpace) return null;
  const { x } = clearSpace;
  // A sliver past the band, so its dashed edge isn't clipped.
  const margin = x * 0.06;
  const box = {
    x: -x - margin,
    y: -x - margin,
    width: w + 2 * (x + margin),
    height: h + 2 * (x + margin),
  };
  // Labels are HTML over the drawing, so they keep one size however far the
  // drawing scales.
  const at = (px: number, py: number): CSSProperties => ({
    left: `${((px - box.x) / box.width) * 100}%`,
    top: `${((py - box.y) / box.height) * 100}%`,
  });
  const units = [0, 1, 2, 3].map((i) => cube.y + i * x);
  const gapLeft = cube.x + cube.width;
  const labels = [
    at(w / 2, -x / 2),
    at(w / 2, h + x / 2),
    at(w + x / 2, h / 2),
    ...units.map((y) => at(-x / 2, y + x / 2)),
    ...(gap ? [at(gapLeft + x / 2, cube.y + cube.height / 2)] : []),
  ];

  return (
    <div
      className="brand-clear-space"
      style={{ aspectRatio: `${box.width} / ${box.height}` }}
    >
      <svg
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        aria-hidden="true"
      >
        <rect
          className="brand-clear-space-zone"
          x={-x}
          y={-x}
          width={w + 2 * x}
          height={h + 2 * x}
        />
        <image href={src} x={0} y={0} width={w} height={h} />
        {units.map((y) => (
          <rect
            key={y}
            className="brand-clear-space-unit"
            x={-x}
            y={y}
            width={x}
            height={x}
          />
        ))}
        {gap && (
          <rect
            className="brand-clear-space-unit"
            x={gapLeft}
            y={cube.y}
            width={x}
            height={cube.height}
          />
        )}
      </svg>
      {labels.map((style, i) => (
        <span key={i} style={style} aria-hidden="true">
          x
        </span>
      ))}
    </div>
  );
}
