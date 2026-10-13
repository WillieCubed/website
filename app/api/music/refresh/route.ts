import { authorizeRefresh, refreshApproved } from '@/lib/music/refresh';
import { StudioError } from '@/lib/studio/errors';

export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    authorizeRefresh(request);
    return Response.json(await refreshApproved(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof StudioError
            ? error.message
            : 'Refresh could not finish.',
      },
      {
        status: error instanceof StudioError ? error.status : 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
