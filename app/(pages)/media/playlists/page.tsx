import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { getPlaylists } from '@/lib/data/spotify';

const TEST_TOKEN = process.env.TEST_SPOTIFY_TOKEN as string;

export const metadata: Metadata = {
  title: "Willie's Playlists",
  description:
    'Ever wonder what Willie listens to? Here are all of his public playlists.',
  openGraph: {
    title: "Willie's Playlists",
    description:
      'Ever wonder what Willie listens to? Here are all of his public playlists.',
    images: ['/assets/meta/playlist-cover.png'],
    url: '/playlists',
  },
};

/**
 * Route: /playlists
 */
export default async function PlaylistsPage() {
  const playlists = (await getPlaylists(TEST_TOKEN)) ?? [];
  return (
    <main className="p-4">
      <section className="flex flex-col justify-center">
        <div className="py-4 mx-auto max-w-xl">
          {playlists.map(({ uri, openableUrl, title, thumbnailUrl }) => {
            return (
              <Link href={openableUrl} key={uri}>
                <div>
                  <Image
                    src={thumbnailUrl}
                    alt={`Playlist Cover art for ${title}`}
                    width={256}
                    height={256}
                  />
                  <div className="py-2 text-xl font-display font-bold">
                    {title}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
