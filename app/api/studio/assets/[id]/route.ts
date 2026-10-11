import { readAsset } from '@/lib/studio/assets';
import { studioRoute } from '@/lib/studio/auth';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return studioRoute(request, async () => {
    const asset = await readAsset((await context.params).id);
    return new Response(asset.stream, {
      headers: {
        'Content-Type': asset.contentType,
        'Content-Disposition': 'inline',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  });
}
