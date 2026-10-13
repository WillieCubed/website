import { approvedManifest } from '@/lib/music/public';
import { isPrivatePreview } from '@/lib/studio/config';

export async function GET() {
  if (isPrivatePreview()) return new Response('Not found', { status: 404 });
  return Response.json(await approvedManifest(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
