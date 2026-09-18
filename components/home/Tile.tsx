'use client';

import { useRef, useState } from 'react';

import type { BrandKey } from '@/lib/home/ventures';

import {
  brandStyle,
  prefersReducedMotion,
  useHome,
  usePreviewHandlers,
} from './HomeContext';
import { Icon } from './Icon';

interface TileProps {
  id: string;
  name: string;
  /** The label in the tile's top corner. */
  head: string;
  hint: string;
  brand: BrandKey;
  size: string;
  children: React.ReactNode;
}

/**
 * One grid tile. It previews its entry on hover and focus, drifts its media
 * toward a mouse pointer, and opens its detail view when clicked.
 */
export function Tile({
  id,
  name,
  head,
  hint,
  brand,
  size,
  children,
}: TileProps) {
  const { matches, openDetail, brands } = useHome();
  const handlers = usePreviewHandlers({ id });
  const ref = useRef<HTMLElement>(null);
  const [hover, setHover] = useState(false);
  const style = brandStyle(brands, brand);

  const className = [
    'tile',
    size,
    hover ? 'hover' : '',
    matches(id) ? 'hit' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      ref={ref}
      className={className}
      data-brand={brand}
      data-branded={style ? '' : undefined}
      id={id}
      data-id={id}
      style={style}
      onPointerEnter={() => {
        handlers.onPointerEnter();
        setHover(true);
      }}
      onPointerLeave={() => {
        handlers.onPointerLeave();
        setHover(false);
        ref.current?.style.removeProperty('--px');
        ref.current?.style.removeProperty('--py');
      }}
      onFocus={() => {
        handlers.onFocus();
        setHover(true);
      }}
      onBlur={() => {
        handlers.onBlur();
        setHover(false);
      }}
      // Media drifts a few pixels toward a mouse pointer so the tile feels
      // physical; touch input and reduced motion skip it.
      onPointerMove={(event) => {
        const el = ref.current;
        if (!el || event.pointerType !== 'mouse' || prefersReducedMotion())
          return;
        const r = el.getBoundingClientRect();
        el.style.setProperty(
          '--px',
          (((event.clientX - r.left) / r.width) * 2 - 1).toFixed(3)
        );
        el.style.setProperty(
          '--py',
          (((event.clientY - r.top) / r.height) * 2 - 1).toFixed(3)
        );
      }}
    >
      <a
        className="cover"
        href={`?detail=${id}`}
        aria-label={name}
        onClick={(event) => {
          event.preventDefault();
          openDetail(id, ref.current);
        }}
      />
      <div className="head">
        <span className="label">{head}</span>
        <span className="hint" aria-hidden="true">
          <span>{hint}</span>
          <i>
            <Icon name="outward" />
          </i>
        </span>
      </div>
      {children}
    </article>
  );
}
