import { renderEntityImage } from '@/lib/og/render';

export const alt = 'Writings by Willie Chalmers III';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return renderEntityImage({
    title: 'Writings',
    description:
      'Thoughts, tutorials, and notes on software, music, and creativity.',
  });
}
