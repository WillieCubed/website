import type { Metadata } from 'next/types';

import { CountdownDays } from '@/components/home/Countdown';
import { HiatusPage } from '@/components/home/HiatusPage';
import { HomeShell } from '@/components/home/HomeShell';
import { Rail } from '@/components/home/Rail';
import { TileGrid } from '@/components/home/TileGrid';
import '@/components/home/home.css';
import Playbill from '@/components/initiatives/Playbill';
import JsonLd from '@/components/seo/JsonLd';

import { allBrandVars } from '@/lib/brand/scheme';
import { facetEntries, getFeaturedTiles } from '@/lib/home/featured';
import { LVBT_DEADLINE, getHomeTiles } from '@/lib/home/ventures';
import { getFeaturedInitiatives } from '@/lib/initiatives';
import { homeGraph } from '@/lib/seo/jsonld';
import { site } from '@/lib/site';
import { HIATUS_MESSAGE, isHiatusMode } from '@/lib/site-mode';

export function generateMetadata(): Metadata {
  if (isHiatusMode()) {
    return {
      title: { absolute: HIATUS_MESSAGE },
      description: HIATUS_MESSAGE,
      openGraph: {
        title: HIATUS_MESSAGE,
        description: HIATUS_MESSAGE,
        url: '/',
        type: 'website',
      },
      twitter: { title: HIATUS_MESSAGE, description: HIATUS_MESSAGE },
    };
  }

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
 * The homepage: a rail with the headline and venture list beside a grid of
 * tiles, each of which opens a detail view.
 *
 * Route: /
 */
export default async function HomePage() {
  if (isHiatusMode()) {
    return <HiatusPage />;
  }

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

  return (
    <>
      <JsonLd data={homeGraph()} />
      <HomeShell
        brands={allBrandVars()}
        detailCountdown={<CountdownDays deadline={LVBT_DEADLINE} />}
        extraEntries={facetEntries(featuredTiles)}
      >
        <Rail />
        <TileGrid tiles={getHomeTiles(featuredTiles)} playbills={playbills} />
      </HomeShell>
    </>
  );
}
