/// <reference types="react/canary" />
import { ViewTransition } from 'react';

import type {
  InitiativeTile as InitiativeTileEntry,
  TileEntry,
  Venture,
} from '@/lib/home/ventures';

import { Constellation } from './Constellation';
import { CountdownDays } from './Countdown';
import { Icon } from './Icon';
import { InitiativeTile } from './InitiativeTile';
import { ProductScroller } from './ProductScroller';
import { Tile } from './Tile';

function VentureBody({ venture }: { venture: Venture }) {
  const { body } = venture;
  switch (body.kind) {
    case 'lead':
      return (
        <div className="body">
          <h3>{body.title}</h3>
          <p>{body.tagline}</p>
          <div className="count" data-media="">
            <b>
              <CountdownDays deadline={body.countdown.deadline} animate />
            </b>
            <span>{body.countdown.caption}</span>
          </div>
          <p className="active">
            <b>Active now:</b> {body.active.join(' · ')}
          </p>
        </div>
      );
    case 'shot':
      return (
        <div className={body.low ? 'shot low' : 'shot'} data-media="">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={body.src} alt={body.alt} />
        </div>
      );
    case 'products':
      return <ProductScroller products={body.products} />;
    case 'atlas':
      return (
        <>
          <div className="atlas-field" data-media="">
            <Constellation />
          </div>
          <span className="atlas-copy">{body.copy}</span>
        </>
      );
  }
}

/**
 * A featured initiative's tile links to its page instead of opening a detail
 * view. A campaign with parts shows its acts; anything else shows its cover.
 * The cover carries a React ViewTransition name so the initiative page can
 * pick it up as a shared element on navigation. Venture tiles keep the DOM
 * View Transition API instead, because their morph is driven by the detail
 * dialog's own document.startViewTransition call.
 */
function InitiativeBody({
  tile,
  playbill,
}: {
  tile: InitiativeTileEntry;
  playbill?: React.ReactNode;
}) {
  if (tile.body === 'playbill' && playbill) {
    return (
      <div className="tile-playbill" data-media="">
        {playbill}
      </div>
    );
  }
  if (!tile.image) return null;
  return (
    <ViewTransition name={`media-${tile.id}`}>
      <div className="shot tile-cover" data-media="">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tile.image.src} alt={tile.image.alt} />
        <span className="tile-tagline">{tile.tagline}</span>
      </div>
    </ViewTransition>
  );
}

export function TileGrid({
  tiles,
  playbills = {},
}: {
  tiles: TileEntry[];
  /** Pre-rendered acts for playbill tiles, keyed by tile id. */
  playbills?: Record<string, React.ReactNode>;
}) {
  return (
    <main className="evidence" aria-label="Work in progress">
      {tiles.map((tile) =>
        tile.kind === 'venture' ? (
          <Tile
            key={tile.id}
            id={tile.id}
            name={tile.venture.name}
            head={
              tile.venture.head ??
              [tile.venture.parent, tile.venture.name]
                .filter(Boolean)
                .join(' · ')
            }
            hint={tile.venture.hint}
            brand={tile.venture.brand}
            size={tile.size}
          >
            <VentureBody venture={tile.venture} />
          </Tile>
        ) : (
          <InitiativeTile key={tile.id} tile={tile}>
            <InitiativeBody tile={tile} playbill={playbills[tile.id]} />
          </InitiativeTile>
        )
      )}
    </main>
  );
}
