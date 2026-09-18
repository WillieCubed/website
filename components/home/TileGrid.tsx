/// <reference types="react/canary" />
import { ViewTransition } from 'react';

import type { InitiativeTile, TileEntry, Venture } from '@/lib/home/ventures';

import { Constellation } from './Constellation';
import { CountdownDays } from './Countdown';
import { Icon } from './Icon';
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
 * view. Its media carries a React ViewTransition name so the initiative page
 * can pick it up as a shared element on navigation. The venture tiles keep
 * the DOM View Transition API instead: their morph is driven by the detail
 * dialog's own document.startViewTransition call, and React's ViewTransition
 * only takes part in React transitions such as route changes, so wrapping
 * venture media in it would leave two owners of the same element name.
 */
function InitiativeCard({ tile }: { tile: InitiativeTile }) {
  return (
    <article className={`tile ${tile.size}`} id={tile.id} data-id={tile.id}>
      <a className="cover" href={tile.href} aria-label={tile.name} />
      <div className="head">
        <span className="label">{tile.head}</span>
        <span className="hint" aria-hidden="true">
          <span>{tile.hint}</span>
          <i>
            <Icon name="outward" />
          </i>
        </span>
      </div>
      {tile.image && (
        <ViewTransition name={`media-${tile.id}`}>
          <div className="shot" data-media="">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tile.image.src} alt={tile.image.alt} />
          </div>
        </ViewTransition>
      )}
    </article>
  );
}

export function TileGrid({ tiles }: { tiles: TileEntry[] }) {
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
          <InitiativeCard key={tile.id} tile={tile} />
        )
      )}
    </main>
  );
}
