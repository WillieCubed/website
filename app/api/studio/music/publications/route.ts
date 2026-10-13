import { musicRoute, readMusicBody } from '@/lib/music/http';
import { publicationResponse, publishMusic } from '@/lib/music/publication';
import { StudioError } from '@/lib/studio/errors';

export const maxDuration = 300;
export async function POST(request: Request) {
  return musicRoute(request, async () => {
    const { revisionId } = await readMusicBody(request);
    if (!/^[a-f0-9-]{36}$/.test(revisionId ?? ''))
      throw new StudioError(422, 'Save and review a Music revision first.');
    return Response.json(publicationResponse(await publishMusic(revisionId)));
  });
}
