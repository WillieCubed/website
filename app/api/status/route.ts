import { readPublicStatus } from '@/lib/status/reader';

export async function GET(request: Request) {
  // Accessing the request keeps this response dynamic; the reader owns caching.
  void request.url;
  try {
    return Response.json(await readPublicStatus(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Status read failed:', error);
    return Response.json(
      { error: 'Status unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
