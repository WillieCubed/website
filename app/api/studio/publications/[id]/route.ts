import { studioRoute } from '@/lib/studio/auth';
import { publicationStatus } from '@/lib/studio/publication';

export async function GET(
  request: Request,
  context: RouteContext<'/api/studio/publications/[id]'>
) {
  return studioRoute(request, async () =>
    Response.json(await publicationStatus((await context.params).id))
  );
}
