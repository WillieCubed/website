import { studioRoute } from '@/lib/studio/auth';
import { beginOAuth } from '@/lib/studio/oauth';

export async function GET(request: Request) {
  return studioRoute(request, async () => {
    const url = new URL(request.url);
    const flow = beginOAuth(url.origin, url.searchParams.get('returnTo'));
    return new Response(null, {
      status: 302,
      headers: {
        Location: flow.url,
        'Set-Cookie': `studio_lattice_flow=${flow.cookie}; HttpOnly; Secure; SameSite=Lax; Path=/api/studio/lattice; Max-Age=600`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
