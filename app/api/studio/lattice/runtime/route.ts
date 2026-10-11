import { studioRoute } from '@/lib/studio/auth';
import { runtimeSelection, selectRuntime } from '@/lib/studio/lattice';

export async function GET(request: Request) {
  return studioRoute(request, async () =>
    Response.json(await runtimeSelection())
  );
}
export async function PATCH(request: Request) {
  return studioRoute(request, async () =>
    Response.json(await selectRuntime((await request.json()).runtimeId))
  );
}
