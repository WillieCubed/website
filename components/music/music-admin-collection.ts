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
  connection: MusicConnection | null,
  editorCatalog: MusicCatalog | null = null
): AdminCollectionView {
  const playlists = data?.playlists ?? [];
  const initialCatalog = editorCatalog ?? loadedMusicCatalog(data);
  return {
    playlists,
    initialCatalog,
    loading: !data || !connection,
    connected: connection?.connected ?? false,
    setupInitially: needsSetup(data, initialCatalog, editorCatalog !== null),
  };
}

/** An imported library starts with its saved choices or an unselected authored order. */
export function loadedMusicCatalog(
  data: MusicAdminCollectionData | null
): MusicCatalog {
  return (
    data?.revision?.body ?? {
      ...emptyCatalog,
      order: data?.playlists.map((playlist) => playlist.id) ?? [],
    }
  );
}
function needsSetup(
  data: MusicAdminCollectionData | null,
  catalog: MusicCatalog,
  recovered: boolean
): boolean {
  return Boolean(
    data &&
    ((!data.revision && !recovered) ||
      (catalog.selected.length === 0 &&
        data.playlists.some((playlist) => playlist.eligible)))
  );
}
