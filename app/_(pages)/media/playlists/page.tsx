import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';

import SiteLink from '@/components/link/SiteLink';

import { getPlaylists } from '@/lib/data/spotify';
import { pageMetadata } from '@/lib/site';

const TEST_TOKEN = process.env.TEST_SPOTIFY_TOKEN as string;

export const metadata: Metadata = pageMetadata({
  title: 'Playlists',
  description:
    'Ever wonder what Willie listens to? Here are all of his public playlists.',
  path: '/media/playlists',
  image: '/assets/meta/playlist-cover.png',
});

/**
 * The Spotify call is uncached network I/O, so it streams inside Suspense
 * and the page shell prerenders without it.
 */
async function PlaylistList() {
  if (!TEST_TOKEN) {
    return (
      <p className="text-body-medium text-muted">
        Playlists are taking a break. Check back soon.
      </p>
    );
  }
  const playlists = await getPlaylists(TEST_TOKEN).catch(() => []);
  return (
    <>
      {playlists.map(({ uri, openableUrl, title, thumbnailUrl }) => {
        return (
          <SiteLink preview={false} href={openableUrl} key={uri}>
            <div>
              <Image
                src={thumbnailUrl}
                alt={`Playlist Cover art for ${title}`}
                width={256}
                height={256}
              />
              <div className="py-2 text-xl font-display font-bold">{title}</div>
            </div>
          </SiteLink>
        );
      })}
    </>
  );
}

/**
 * Route: /media/playlists
 */
export default function PlaylistsPage() {
  return (
    <main className="p-4">
      <section className="flex flex-col justify-center">
        <div className="py-4 mx-auto max-w-xl">
          <Suspense
            fallback={
              <p className="text-body-medium text-muted">Loading playlists…</p>
            }
          >
            <PlaylistList />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
