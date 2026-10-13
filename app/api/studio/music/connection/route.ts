import { musicRoute } from '@/lib/music/http';
import { getStudioPool } from '@/lib/studio/store';

export async function GET(request: Request) {
  return musicRoute(request, async () => {
    const pool = getStudioPool(),
      row = (
        await pool.query(
          'SELECT owner_id,reconnect,updated_at FROM music_connections WHERE singleton=true'
        )
      ).rows[0];
    return Response.json({
      configured: Boolean(
        process.env.SPOTIFY_CLIENT_ID && process.env.STUDIO_TOKEN_ENCRYPTION_KEY
      ),
      connected: Boolean(row && !row.reconnect),
      reconnect: Boolean(row?.reconnect),
      ownerId: row?.owner_id ?? null,
      import:
        (
          await pool.query(
            'SELECT body FROM music_import_state WHERE singleton=true'
          )
        ).rows[0]?.body ?? null,
    });
  });
}
