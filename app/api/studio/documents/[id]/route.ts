import { studioRoute } from '@/lib/studio/auth';
import { parseDraftContent } from '@/lib/studio/document';
import { StudioError } from '@/lib/studio/errors';
import { getStudioStore } from '@/lib/studio/store';

type Context = RouteContext<'/api/studio/documents/[id]'>;
export async function GET(request: Request, context: Context) {
  return studioRoute(request, async () => {
    const value = await getStudioStore().get((await context.params).id);
    if (!value) throw new StudioError(404, 'Writing not found.');
    return Response.json(value);
  });
}
export async function PUT(request: Request, context: Context) {
  return studioRoute(request, async () => {
    const value = await request.json();
    if (typeof value.expectedRevisionId !== 'string')
      throw new StudioError(400, 'A save needs its expected revision.');
    return Response.json(
      await getStudioStore().save(
        (await context.params).id,
        value.expectedRevisionId,
        parseDraftContent(value.body)
      )
    );
  });
}
export async function DELETE(request: Request, context: Context) {
  return studioRoute(request, async () => {
    const value = await request.json();
    if (typeof value.expectedRevisionId !== 'string')
      throw new StudioError(400, 'A delete needs its expected revision.');
    await getStudioStore().remove(
      (await context.params).id,
      value.expectedRevisionId
    );
    return new Response(null, { status: 204 });
  });
}
