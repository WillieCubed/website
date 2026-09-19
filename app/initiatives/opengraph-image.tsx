import { renderEntityImage } from '@/lib/og/render';

export const alt = 'Initiatives from Willie Chalmers III';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return renderEntityImage({
    title: 'Initiatives',
    description:
      'The campaigns, series, and projects Willie is running right now.',
  });
}
