import { renderEntityImage } from '@/lib/seo/og/render';
import { sitePage } from '@/lib/site/navigation';

export const alt = 'Initiatives from Willie Chalmers III';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Render a PNG social preview with the initiatives index title and
 * description.
 */
export default async function Image() {
  const page = sitePage('/initiatives');
  return renderEntityImage({
    title: page.label,
    description: page.description,
  });
}
