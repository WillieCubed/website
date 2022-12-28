import { generateCodeChallenge, SPOTIFY_ACCOUNTS_URL, SPOTIFY_REDIRECT_URI, spotify_state_code } from '../../../lib/spotify-playlist-utils';

const SCOPES = 'playlist-read-private';


/**
 * The main entrypoint to the site.
 *
 * Route: /admin
 */
export default async function AdminPage() {
  const spotifyCodeChallenge = await generateCodeChallenge();

  const queryString = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID as string,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: spotify_state_code,
    scope: SCOPES,
    // show_dialog: 'true',
    // code_challenge_method: 'S256',
    // code_challenge: spotifyCodeChallenge,
  }).toString();
  const string = `${SPOTIFY_ACCOUNTS_URL}/authorize?${queryString}`;
  return (
    <main className="">
      <section id="overview" className="mx-auto max-w-4xl py-4 space-y-2">
        <div className="text-display-medium font-display">Admin console</div>
        <p className="text-xl">Use this page to modify site configuration.</p>
      </section>
      <section id="playlists" className="mx-auto max-w-4xl py-4 space-y-3">
        <h1 className="text-display-small font-display">
          Playlists
        </h1>
        <div>Use <a href={string} className="text-primary underline">this</a> link to fetch your authorization token from the Spotify API.</div>
      </section>
    </main>
  );
}
