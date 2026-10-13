import { NextRequest } from 'next/server';

import { completeSpotify } from '@/lib/music/spotify/oauth';
import { authorizeStudio } from '@/lib/studio/auth';
import { privateHeaders, studioOrigin } from '@/lib/studio/config';
import { StudioError } from '@/lib/studio/errors';

export async function GET(request: NextRequest) {
  try {
    const owner = await authorizeStudio(request);
    await completeSpotify(
      owner.email,
      request.nextUrl.searchParams,
      request.cookies.get('__Host-music-oauth')?.value ?? null
    );
    return new Response(null, {
      status: 303,
      headers: {
        ...privateHeaders,
        Location: `${studioOrigin()}/studio/music?connected=1`,
        'Set-Cookie':
          '__Host-music-oauth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      },
    });
  } catch (error) {
    if (error instanceof StudioError && [401, 403, 404].includes(error.status))
      return Response.json(
        { error: error.message },
        { status: error.status, headers: privateHeaders }
      );
    const message =
      error instanceof StudioError
        ? error.message
        : 'Spotify could not finish connecting. Try again.';
    return new Response(null, {
      status: 303,
      headers: {
        ...privateHeaders,
        Location: `${studioOrigin()}/studio/music?connectionError=${encodeURIComponent(message)}`,
        'Set-Cookie':
          '__Host-music-oauth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      },
    });
  }
}
