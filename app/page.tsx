import type { Metadata } from 'next/types';

import { CountdownDays } from '@/components/home/Countdown';
import { HomeShell } from '@/components/home/HomeShell';
import { Rail } from '@/components/home/Rail';
import { TileGrid } from '@/components/home/TileGrid';
import '@/components/home/home.css';
import Playbill from '@/components/initiatives/Playbill';
import JsonLd from '@/components/seo/JsonLd';
import DockFooter from '@/components/site/DockFooter';

import { allBrandVars } from '@/lib/brand/scheme';
import { detailMetadata } from '@/lib/home/detail-metadata';
import { focusEntries, getFeaturedTiles } from '@/lib/home/featured';
import { focuses, iconPicture, tilesByFocus } from '@/lib/home/focuses';
import {
  LVBT_DEADLINE,
  type TileEntry,
  getHomeTiles,
} from '@/lib/home/ventures';
import { getFeaturedInitiatives } from '@/lib/initiatives';
import { homeGraph } from '@/lib/seo/jsonld';
import { site } from '@/lib/site';

interface HomePageProps {
  searchParams: Promise<{ detail?: string | string[] }>;
}

export async function generateMetadata({
  searchParams,
}: HomePageProps): Promise<Metadata> {
  // An open detail view names its venture, matching the first `detail`
  // value the way the dialog's useSearchParams().get() does.
  const { detail } = await searchParams;
  const opened = detailMetadata(Array.isArray(detail) ? detail[0] : detail);
  if (opened) return opened;

  return {
    title: { absolute: site.name },
    description: site.description,
    alternates: { canonical: '/' },
    openGraph: {
      siteName: site.name,
      locale: site.locale,
      title: site.name,
      description: site.shortDescription,
      url: '/',
      type: 'profile',
      firstName: site.author.givenName,
      lastName: site.author.familyName,
      images: [
        {
          url: site.ogImage,
          width: 1200,
          height: 630,
          alt: site.shortDescription,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: site.name,
      description: site.shortDescription,
      images: [{ url: site.ogImage, alt: site.shortDescription }],
    },
  };
}

/**
 * The homepage: a rail with the headline and Willie's focuses beside a grid
 * of tiles, each of which opens a detail view.
 *
 * Route: /
 */
export default async function HomePage() {
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
    const vars = own[0] && brandVarsOfTile(own[0], brands);
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
  brands: Record<string, Record<string, string>>
): Record<string, string> | undefined {
  const vars =
    tile.kind === 'venture' ? brands[tile.venture.brand] : tile.brandVars;
  return vars && Object.keys(vars).length > 0 ? vars : undefined;
}
