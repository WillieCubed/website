import { emptyCatalog } from '@/lib/music/types';
import type {
  MusicAdminCollectionData,
  MusicCatalog,
  MusicConnection,
  MusicPlaylist,
} from '@/lib/music/types';

export interface AdminCollectionView {
  playlists: MusicPlaylist[];
  initialCatalog: MusicCatalog;
  loading: boolean;
  connected: boolean;
  setupInitially: boolean;
}
export function adminCollectionView(
  data: MusicAdminCollectionData | null,
  connection: MusicConnection | null
): AdminCollectionView {
  const playlists = data?.playlists ?? [];
  const initialCatalog = data?.revision?.body ?? {
    ...emptyCatalog,
    order: playlists.map((playlist) => playlist.id),
  };
  return {
    playlists,
    initialCatalog,
    loading: !data || !connection,
    connected: connection?.connected ?? false,
    setupInitially: needsSetup(data, initialCatalog),
  };
}
function needsSetup(
  data: MusicAdminCollectionData | null,
  catalog: MusicCatalog
): boolean {
  return Boolean(
    data &&
    (!data.revision ||
      (!catalog.selected.length &&
        data.playlists.some((playlist) => playlist.eligible)))
  );
}
