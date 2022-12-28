import { SPOTIFY_API_BASE_URI } from '../../../lib/spotify-playlist-utils';
import Image from 'next/image';
import Link from 'next/link';

const TEST_TOKEN = process.env.TEST_SPOTIFY_TOKEN as string;

/**
 * Route: /playlists
 */
export default async function PlaylistsPage() {
  const playlists = await getPlaylists(TEST_TOKEN);
  return (
    <main className="p-4">
      <section className="flex flex-col justify-center">
        <div className="py-4 mx-auto max-w-xl">
          {playlists.map(({ uri, openableUrl, title, thumbnailUrl }) => {
            return (
              <Link href={openableUrl} key={uri}>
                <div>
                  <Image src={thumbnailUrl} alt={`Playlist Cover art for ${title}`} width={256} height={256} />
                  <div className="py-2 text-xl font-display font-bold">{title}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
};

const PLAYLISTS_ENDPOINT = '/me/playlists';

type PlaylistInfo = {
  /**
   * Treated as the primary identifer for this resource. 
   */
  uri: string;
  openableUrl: string;
  title: string;
  thumbnailUrl: string;
  public: boolean;
}

function mapItemtoPlaylistInfo(info: Record<string, any>): PlaylistInfo {
  return {
    uri: info.uri,
    openableUrl: info.external_urls.spotify,
    title: info.name,
    thumbnailUrl: info.images[0].url,
    public: info.public,
  };
}

async function getPlaylists(accessCode: string): Promise<PlaylistInfo[]> {
  // TODO: Error handling
  const response = await fetch(`${SPOTIFY_API_BASE_URI}${PLAYLISTS_ENDPOINT}`, {
    headers: {
      'Authorization': `Bearer ${accessCode}`,
    },
  });
  const json = await response.json();
  const allItems = json.items as Record<string, any>[];
  const playlists = allItems.map(mapItemtoPlaylistInfo).filter(item => item.public);
  return playlists;
}
