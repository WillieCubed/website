import { studioRoute } from '@/lib/studio/auth';
import { completeOAuth } from '@/lib/studio/oauth';

export async function GET(request: Request) {
  return studioRoute(request, async () => {
    const returnTo = await completeOAuth(request);
    return new Response(null, {
      status: 303,
      headers: {
        Location: returnTo,
        'Set-Cookie':
          'studio_lattice_flow=; HttpOnly; Secure; SameSite=Lax; Path=/api/studio/lattice; Max-Age=0',
        'Cache-Control': 'no-store',
      },
    });
  });
}
