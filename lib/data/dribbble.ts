const DRIBBLE_ENDPOINT = 'https://api.dribbble.com/v2/user';

type DribbbleShot = {
  id: string;
  title: string;
  description: string;
  images: {
    hidpi: string;
    normal: string;
    teaser: string;
  };
  published_at: string;
  updated_at: string;
  html_url: string;
};

export async function fetchDribbleShots() {
  const dribbleToken = process.env.DRIBBBLE_ACCESS_TOKEN;
  // TODO: Check if token is expired

  // Fetch dribble shots from dribble API
  const data = await fetch(`${DRIBBLE_ENDPOINT}/shots`, {
    headers: {
      Authorization: `Bearer ${dribbleToken}`,
    },
  });
  const shots = (await data.json()) as DribbbleShot[];
  return shots;
  // Store dribble shots in database
}
