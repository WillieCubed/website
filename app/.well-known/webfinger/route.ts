import { buildWebFingerResponse } from '@/lib/indieweb/discovery';
import { jsonResponse } from '@/lib/indieweb/responses';

export async function GET(request: Request) {
  const url = new URL(request.url);

  return jsonResponse(
    buildWebFingerResponse(url.searchParams.get('resource')),
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Content-Type': 'application/jrd+json; charset=utf-8',
      },
    }
  );
}
