import { musicRoute } from '@/lib/music/http';
import {
  musicPublicationStatus,
  publicationResponse,
} from '@/lib/music/publication';
import { StudioError } from '@/lib/studio/errors';

export const maxDuration = 300;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return musicRoute(request, async () => {
    const { id } = await params;
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new StudioError(404, 'Publication not found.');
    return Response.json(publicationResponse(await musicPublicationStatus(id)));
  });
}
