import { isPrivatePreview, privateHeaders } from '@/lib/studio/config';
import { latticeClientMetadata } from '@/lib/studio/lattice-client-metadata';

/** Lovelace fetches this production document to resolve our URL client ID. */
export async function GET() {
  if (isPrivatePreview())
    return new Response('Not found', { status: 404, headers: privateHeaders });
  return Response.json(latticeClientMetadata(), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
