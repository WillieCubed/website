import { renderEntityImage } from '@/lib/og/render';
import { sitePage } from '@/lib/site';

export const alt = 'Initiatives from Willie Chalmers III';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const page = sitePage('/initiatives');
  return renderEntityImage({
    title: page.label,
    description: page.description,
  });
}
