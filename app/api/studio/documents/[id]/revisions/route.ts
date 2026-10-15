import { studioRoute } from '@/lib/studio/auth';
import { getStudioStore } from '@/lib/studio/store';

export async function GET(
  request: Request,
  context: RouteContext<'/api/studio/documents/[id]/revisions'>
) {
  return studioRoute(request, async () =>
    Response.json(await getStudioStore().revisions((await context.params).id))
  );
}
