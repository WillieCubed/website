import { notFound } from 'next/navigation';

import { renderEntityImage } from '@/lib/seo/og/render';
import { getTagGroup } from '@/lib/writings/index';
import { tagFromParam, writingCount } from '@/lib/writings/tags';

export const alt = 'Tagged writings';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Render a PNG social preview with the tag and public writing count. Return
 * 404 when the tag has no public writings.
 */
interface SocialImageProps {
  params: PageProps<'/writings/tags/[tag]'>['params'];
}

export default async function Image(props: SocialImageProps) {
  const { tag } = await props.params;
  const group = (await getTagGroup(tagFromParam(tag))) ?? notFound();
  return renderEntityImage({
    title: `#${group.tag}`,
    description: writingCount(group.writings.length),
  });
}
