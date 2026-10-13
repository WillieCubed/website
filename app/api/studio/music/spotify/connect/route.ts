import { musicRoute } from '@/lib/music/http';
import { beginSpotify } from '@/lib/music/spotify/oauth';
import { authorizeStudio } from '@/lib/studio/auth';

export async function POST(request: Request) {
  return musicRoute(request, async () => {
    const owner = await authorizeStudio(request);
    const result = await beginSpotify(owner.email);
    return Response.json(
      { url: result.url },
      {
        headers: {
          'Set-Cookie': `__Host-music-oauth=${result.state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
        },
      }
    );
  });
}
