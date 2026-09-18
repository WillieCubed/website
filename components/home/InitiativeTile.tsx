'use client';

import { useState } from 'react';

import SiteLink from '@/components/link/SiteLink';

import type { InitiativeTile as InitiativeTileEntry } from '@/lib/home/ventures';

import { useHome, usePreviewHandlers } from './HomeContext';
import { Icon } from './Icon';

interface InitiativeTileProps {
  tile: InitiativeTileEntry;
  children: React.ReactNode;
}

/**
 * A featured initiative's tile. It previews like a venture tile, takes on
 * the initiative's own scheme on hover, and links to the initiative page
 * instead of opening a detail view.
 */
export function InitiativeTile({ tile, children }: InitiativeTileProps) {
  const { matches } = useHome();
  const handlers = usePreviewHandlers({ id: tile.id });
  const [hover, setHover] = useState(false);
  const className = [
    'tile',
    'initiative-tile',
    tile.size,
    hover ? 'hover' : '',
    matches(tile.id) ? 'hit' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={className}
      id={tile.id}
      data-id={tile.id}
      data-brand={tile.brandVars ? 'initiative' : undefined}
      data-branded={tile.brandVars ? '' : undefined}
      style={tile.brandVars as React.CSSProperties | undefined}
      onPointerEnter={() => {
        handlers.onPointerEnter();
        setHover(true);
      }}
      onPointerLeave={() => {
        handlers.onPointerLeave();
        setHover(false);
      }}
      onFocus={() => {
        handlers.onFocus();
        setHover(true);
      }}
      onBlur={() => {
        handlers.onBlur();
        setHover(false);
      }}
    >
      <SiteLink
        className="cover"
        href={tile.href}
        aria-label={tile.name}
        preview={false}
      />
      <div className="head">
        <span className="label">{tile.head}</span>
        <span className="hint" aria-hidden="true">
          <span>{tile.hint}</span>
          <i>
            <Icon name="outward" />
          </i>
        </span>
      </div>
      {children}
    </article>
  );
}
