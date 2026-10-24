'use client';

import { useState } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import SharedTitle from '@/components/site/SharedTitle';

import type { InitiativeTile as InitiativeTileEntry } from '@/lib/home/ventures';

import { useHome, usePreviewHandlers } from './HomeContext';

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
        <h3 className="tile-title">
          {tile.parent && `${tile.parent} · `}
          {/* Inline, not inline-block: the title never wraps, and an
              atomic box would lose its ellipsis. */}
          <SharedTitle id={tile.id} size="small">
            <span>{tile.name}</span>
          </SharedTitle>
        </h3>
        <span className="hint" aria-hidden="true">
          <span>{tile.hint}</span>
          <i>
            <Icon name="outward" className="icon" />
          </i>
        </span>
      </div>
      {children}
    </article>
  );
}
