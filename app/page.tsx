import type { Metadata } from 'next/types';

import { CountdownDays } from '@/components/home/Countdown';
import { HiatusPage } from '@/components/home/HiatusPage';
import { HomeShell } from '@/components/home/HomeShell';
import { Rail } from '@/components/home/Rail';
import { TileGrid } from '@/components/home/TileGrid';
import '@/components/home/home.css';

import { allBrandVars } from '@/lib/brand/scheme';
import { LVBT_DEADLINE, getHomeTiles } from '@/lib/home/ventures';
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
      title: site.name,
      description: site.shortDescription,
      url: '/',
      type: 'profile',
      firstName: site.author.givenName,
      lastName: site.author.familyName,
    },
    twitter: {
      title: site.name,
      description: site.shortDescription,
    },
  };
}

/**
 * The homepage: a rail with the headline and venture list beside a grid of
 * tiles, each of which opens a detail view.
 *
 * Route: /
 */
export default function HomePage() {
  if (isHiatusMode()) {
    return <HiatusPage />;
  }

  return (
    <HomeShell
      brands={allBrandVars()}
      detailCountdown={<CountdownDays deadline={LVBT_DEADLINE} />}
    >
      <Rail />
      <TileGrid tiles={getHomeTiles()} />
    </HomeShell>
  );
}
