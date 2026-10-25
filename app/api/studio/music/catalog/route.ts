import { HttpError } from '@/lib/http/errors';
import { musicRoute, readMusicBody } from '@/lib/music/http';
import { publicationResponse } from '@/lib/music/publication';
import { parseCatalog } from '@/lib/music/schema';
import { musicStore } from '@/lib/music/store';

export async function GET(request: Request) {
  return musicRoute(request, async () => {
    const store = musicStore(),
      head = await store.head();
    const publication = head
      ? (
          await store.pool.query(
            'SELECT body FROM music_publications WHERE revision_id=$1',
            [head.id]
          )
        ).rows[0]?.body
      : null;
    return Response.json({
      revision: head,
      playlists: await store.playlists(),
      publication: publication ? publicationResponse(publication) : null,
    });
  });
}
export async function PUT(request: Request) {
  return musicRoute(request, async () => {
    const input = await readMusicBody(request),
      store = musicStore();
    if (
      input.expectedRevisionId !== null &&
      !/^[a-f0-9-]{36}$/.test(input.expectedRevisionId ?? '')
    )
      throw new HttpError(422, 'Invalid saved revision.');
    let body;
    try {
      body = parseCatalog(
        input.catalog,
        (await store.playlists()).map((p) => p.id)
      );
    } catch {
      throw new HttpError(
        422,
        'The collection contains invalid selections. Refresh the library and try again.'
      );
    }
    return Response.json({
      revision: await store.save(input.expectedRevisionId, body),
    });
  });
}
