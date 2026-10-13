import { publicCollection } from '@/lib/music/public';
import { isPrivatePreview } from '@/lib/studio/config';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isPrivatePreview()) return new Response('Not found', { status: 404 });
  const { id } = await params;
  const playlist = (await publicCollection()).playlists.find(
    (p) => p.id === id
  );
  return playlist
    ? Response.json(playlist, { headers: { 'Cache-Control': 'no-store' } })
    : new Response('Not found', { status: 404 });
}
