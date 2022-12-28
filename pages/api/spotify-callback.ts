import type { NextApiRequest, NextApiResponse } from 'next';
import { SPOTIFY_ACCOUNTS_URL, SPOTIFY_API_BASE_URI, SPOTIFY_REDIRECT_URI, TEST_CODE_VERIFIER } from '../../lib/spotify-playlist-utils';

type SpotifyCallbackData = {
  access_token: string;
  expires_in: string;
  refresh_token: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SpotifyCallbackData>
) {
  console.log('Initial query');
  const { code, state } = req.query;

  const authorization = new Buffer(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  try {
    if (!state) {
      res.status(400);
      console.error('State not defined');
    }
    const requestBody = new URLSearchParams({
      code: code as string,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      grant_type: 'authorization_code',
      // client_id: process.env.SPOTIFY_CLIENT_ID as string,
      // code_verifier: TEST_CODE_VERIFIER,
    });
    const response = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
      method: 'POST',
      body: requestBody,
      headers: {
        'Authorization': `Basic ${authorization}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const json = await response.json();
    // TODO: Store access code in database
    const { access_token, expires_in, refresh_token } = json;
    res.status(200).send({ access_token, expires_in, refresh_token });
  } catch (error) {
    console.error(error);
    res.status(500);
  }
}
