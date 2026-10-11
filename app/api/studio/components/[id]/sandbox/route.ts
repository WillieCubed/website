import { studioRoute } from '@/lib/studio/auth';
import { compileSandbox } from '@/lib/studio/components';
import { StudioError } from '@/lib/studio/errors';
import { getStudioStore } from '@/lib/studio/store';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return studioRoute(request, async () => {
    const proposal = await getStudioStore().proposal((await context.params).id);
    if (!proposal) throw new StudioError(404, 'Component not found.');
    return new Response(await compileSandbox(proposal), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy':
          "sandbox allow-scripts; frame-ancestors 'self'",
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  });
}
