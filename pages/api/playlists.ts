import type { NextApiRequest, NextApiResponse } from 'next';

type PlaylistData = {
  name: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<PlaylistData>
) {
  res.status(200).json({ name: 'John Doe' });
}
