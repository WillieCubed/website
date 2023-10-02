import { SPOTIFY_API_BASE_URI } from '../spotify-playlist-utils';

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
};

function mapItemtoPlaylistInfo(info: Record<string, any>): PlaylistInfo {
  return {
    uri: info.uri,
    openableUrl: info.external_urls.spotify,
    title: info.name,
    thumbnailUrl: info.images[0].url,
    public: info.public,
  };
}

export async function getPlaylists(
  accessCode: string
): Promise<PlaylistInfo[]> {
  // TODO: Error handling
  const response = await fetch(`${SPOTIFY_API_BASE_URI}${PLAYLISTS_ENDPOINT}`, {
    headers: {
      Authorization: `Bearer ${accessCode}`,
    },
  });
  const json = await response.json();
  const allItems = (json.items as Record<string, any>[]) || [];
  const playlists = allItems
    .map(mapItemtoPlaylistInfo)
    .filter((item) => item.public);
  return playlists;
}
