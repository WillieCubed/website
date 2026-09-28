import { notFound } from 'next/navigation';

import { renderEntityImage } from '@/lib/og/render';
import { getTagGroup } from '@/lib/writings';
import { tagFromParam, writingCount } from '@/lib/writings/tags';

export const alt = 'Tagged writings';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image(props: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await props.params;
  const group = (await getTagGroup(tagFromParam(tag))) ?? notFound();
  return renderEntityImage({
    title: `#${group.tag}`,
    description: writingCount(group.writings.length),
  });
}
