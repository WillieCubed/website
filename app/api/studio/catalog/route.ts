import { studioRoute } from '@/lib/studio/auth';
import { BUILTIN_CATALOG } from '@/lib/studio/catalog';
import { getStudioStore } from '@/lib/studio/store';

export async function GET(request: Request) {
  return studioRoute(request, async () => {
    const proposals = await getStudioStore().proposals();
    return Response.json({
      entries: [
        ...BUILTIN_CATALOG,
        ...proposals
          .filter((p) => p.status === 'approved')
          .map((p) => ({ ...p, component: 'StudioBlock' })),
      ],
      proposals,
    });
  });
}
