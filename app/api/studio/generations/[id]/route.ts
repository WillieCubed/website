import { studioRoute } from '@/lib/studio/auth';
import { StudioError } from '@/lib/studio/errors';
import {
  generationAction,
  requireComponentGeneration,
} from '@/lib/studio/lattice';
import { getStudioStore } from '@/lib/studio/store';

export const maxDuration = 180;
type Context = RouteContext<'/api/studio/generations/[id]'>;
export async function GET(request: Request, context: Context) {
  return studioRoute(request, async () => {
    const generation = await getStudioStore().getGeneration(
      (await context.params).id
    );
    if (!generation) throw new StudioError(404, 'Generation not found.');
    requireComponentGeneration(generation.kind);
    return Response.json(generation);
  });
}
export async function PATCH(request: Request, context: Context) {
  return studioRoute(request, async () => {
    const body = await request.json();
    return Response.json(
      await generationAction(
        (await context.params).id,
        body.action,
        body.expectedRevisionId
      )
    );
  });
}
