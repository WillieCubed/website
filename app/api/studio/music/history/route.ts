import { musicRoute, readMusicBody } from '@/lib/music/http';
import { musicStore } from '@/lib/music/store';
import { StudioError } from '@/lib/studio/errors';

export async function GET(request: Request) {
  return musicRoute(request, async () =>
    Response.json({ revisions: await musicStore().history() })
  );
}
export async function POST(request: Request) {
  return musicRoute(request, async () => {
    const input = await readMusicBody(request);
    if (!/^[a-f0-9-]{36}$/.test(input.revisionId ?? ''))
      throw new StudioError(422, 'Invalid revision.');
    const store = musicStore(),
      revision = await store.revision(input.revisionId);
    if (!revision) throw new StudioError(404, 'Revision not found.');
    const known = (await store.playlists()).map((p) => p.id);
    const body = {
      ...revision.body,
      order: [
        ...revision.body.order,
        ...known.filter((id) => !revision.body.order.includes(id)),
      ],
    };
    return Response.json({
      revision: await store.save(input.expectedRevisionId ?? null, body),
    });
  });
}
