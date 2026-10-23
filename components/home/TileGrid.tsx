import type {
  InitiativeTile as InitiativeTileEntry,
  TileEntry,
  Venture,
} from '@/lib/home/ventures';
import { localImageSources } from '@/lib/media/responsive';

import { Constellation } from './Constellation';
import { CountdownDays } from './Countdown';
import { InitiativeTile } from './InitiativeTile';
import { ProductScroller } from './ProductScroller';
import { Tile } from './Tile';

/**
 * The first two tiles share the top row of the widest grid, so their
 * pictures load right away. Every later tile starts below the fold on at
 * least one layout, and on a phone all of them do, so theirs wait until the
 * visitor scrolls near.
 */
const EAGER_TILES = 2;

type Loading = 'eager' | 'lazy';

interface VentureBodyProps {
  venture: Venture;
  loading: Loading;
}

function VentureBody({ venture, loading }: VentureBodyProps) {
  const { body } = venture;
  switch (body.kind) {
    case 'lead':
      return (
        <div className="body">
          <h3>{body.title}</h3>
          <p>{body.tagline}</p>
          <div className="count" data-media="">
            <b data-morph={venture.id}>
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
        <div
          className={body.low ? 'shot low' : 'shot'}
          data-media=""
          data-morph={venture.id}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={body.src}
            {...localImageSources(
              body.src,
              body.width,
              body.height,
              '(max-width: 599px) 90vw, (max-width: 839px) 45vw, 40vw'
            )}
            width={body.width}
            height={body.height}
            alt={body.alt}
            loading={loading}
            decoding="async"
          />
        </div>
      );
    case 'products':
      return <ProductScroller products={body.products} loading={loading} />;
    case 'atlas':
      return (
        <>
          <div className="atlas-field" data-media="">
            <Constellation morph={venture.id} />
          </div>
          <span className="atlas-copy">{body.copy}</span>
        </>
      );
  }
}

/**
 * A featured initiative's tile links to its page instead of opening a detail
 * view. A campaign with parts shows its acts; anything else shows its cover.
 */
interface InitiativeBodyProps {
  tile: InitiativeTileEntry;
  playbill?: React.ReactNode;
  loading: Loading;
}

function InitiativeBody({ tile, playbill, loading }: InitiativeBodyProps) {
  if (tile.body === 'playbill' && Boolean(playbill)) {
    return (
      <div className="tile-playbill" data-media="">
        {playbill}
      </div>
    );
  }
  if (!tile.image) return null;
  return (
    <div className="shot tile-cover" data-media="">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tile.image.src}
        alt={tile.image.alt}
        loading={loading}
        decoding="async"
      />
    </div>
  );
}

interface TileGridProps {
  tiles: TileEntry[];
  /** Pre-rendered acts for playbill tiles, keyed by tile id. */
  playbills?: Record<string, React.ReactNode>;
}

export function TileGrid({ tiles, playbills = {} }: TileGridProps) {
  return (
    <main id="main" className="evidence" aria-label="Work in progress">
      {tiles.map((tile, i) => {
        const loading = i < EAGER_TILES ? 'eager' : 'lazy';
        return tile.kind === 'venture' ? (
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
            <VentureBody venture={tile.venture} loading={loading} />
          </Tile>
        ) : (
          <InitiativeTile key={tile.id} tile={tile}>
            <InitiativeBody
              tile={tile}
              playbill={playbills[tile.id]}
              loading={loading}
            />
          </InitiativeTile>
        );
      })}
    </main>
  );
}
