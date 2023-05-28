import { NextResponse } from 'next/server';

type Playlist = {
  /**
   * The name of this playlist.
   */
  name: string;
  /**
   * A third-party URL to listen to the songs on this playlist.
   */
  url: string;
  /**
   * An ISO 8601-compliant timestamp of when this playlist was created.
   */
  creationDate: string;
};

export async function GET(request: Request) {
  return NextResponse.json<Playlist[]>([]);
}
