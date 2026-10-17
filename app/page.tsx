import type { Metadata } from 'next/types';

import { CountdownDays } from '@/components/home/Countdown';
import { HomeShell } from '@/components/home/HomeShell';
import { Rail } from '@/components/home/Rail';
import { TileGrid } from '@/components/home/TileGrid';
import '@/components/home/home.css';
import Playbill from '@/components/initiatives/Playbill';
import JsonLd from '@/components/seo/JsonLd';
import DockFooter from '@/components/site/DockFooter';

import type { BrandSchemeVars } from '@/lib/brand/material-scheme';
import { type BrandSchemes, allBrandVars } from '@/lib/brand/scheme';
import { detailMetadata } from '@/lib/home/detail-metadata';
import { focusEntries, getFeaturedTiles } from '@/lib/home/featured';
import { focuses, iconPicture, tilesByFocus } from '@/lib/home/focuses';
import {
  LVBT_DEADLINE,
  type TileEntry,
  getHomeTiles,
} from '@/lib/home/ventures';
import { getFeaturedInitiatives } from '@/lib/initiatives/index';
import { homeGraph } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';
import { site } from '@/lib/site/identity';

export async function generateMetadata({
  searchParams,
}: PageProps<'/'>): Promise<Metadata> {
  // An open detail view names its venture, matching the first `detail`
  // value the way the dialog's useSearchParams().get() does.
  const { detail } = await searchParams;
  const opened = detailMetadata(Array.isArray(detail) ? detail[0] : detail);
  if (opened) return opened;

  // The site name already heads a link preview, so its title is the
  // headline sentence rather than the name a second time.
  const shared = pageMetadata({
    title: site.shortDescription,
    description: site.lede,
    path: '/',
    type: 'profile',
  });
  return {
    ...shared,
    title: { absolute: site.name },
    description: site.description,
    openGraph: {
      ...shared.openGraph,
      type: 'profile',
      firstName: site.author.givenName,
      lastName: site.author.familyName,
    },
  };
}

/**
 * The homepage: a rail with the headline and Willie's focuses beside a grid
 * of tiles, each of which opens a detail view.
 *
 * Route: /
 */
export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const { detail } = await searchParams;
  const initialDetail = Array.isArray(detail) ? detail[0] : detail;
  const [featuredTiles, featured] = await Promise.all([
    getFeaturedTiles(),
    getFeaturedInitiatives(),
  ]);
  const playbills = Object.fromEntries(
    featured
      .filter((initiative) => initiative.parts.length > 0)
      .map((initiative) => [
        `initiative-${initiative.slug}`,
        <Playbill
          key={initiative.slug}
          initiative={initiative}
          variant="compact"
        />,
      ])
  );

  const tiles = getHomeTiles(featuredTiles);
  const brands = allBrandVars();
  const byFocus = tilesByFocus(
    tiles.map((tile) => ({ id: tile.id, focuses: focusesOfTile(tile) }))
  );
  const focusItems = focuses.map((focus) => {
    const own = tiles.filter((tile) => byFocus[focus.id].includes(tile.id));
    const vars = own[0] != null && brandVarsOfTile(own[0], brands);
    return {
      ...focus,
      live: own.length > 0,
      style: vars as React.CSSProperties | undefined,
      stack: focus.icons.map(iconPicture),
    };
  });

  return (
    <>
      <JsonLd data={homeGraph()} />
      {/* The footer is this page's contact row until the page ends. */}
      <DockFooter />
      <HomeShell
        initialDetail={initialDetail}
        brands={brands}
        detailCountdown={<CountdownDays deadline={LVBT_DEADLINE} />}
        extraEntries={focusEntries(featuredTiles)}
      >
        <Rail focuses={focusItems} />
        <TileGrid tiles={tiles} playbills={playbills} />
      </HomeShell>
    </>
  );
}

function focusesOfTile(tile: TileEntry) {
  return tile.kind === 'venture' ? tile.venture.focuses : tile.focuses;
}

/** A tile's brand scheme, if it has one: a venture's by key, an initiative's own. */
function brandVarsOfTile(
  tile: TileEntry,
  brands: BrandSchemes
): BrandSchemeVars | undefined {
  const vars =
    tile.kind === 'venture' ? brands[tile.venture.brand] : tile.brandVars;
  return vars && Object.keys(vars).length > 0 ? vars : undefined;
}
