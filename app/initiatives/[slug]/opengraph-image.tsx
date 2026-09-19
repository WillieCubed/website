import { notFound } from 'next/navigation';

import { formatRange } from '@/components/initiatives/dates';

import { getInitiative } from '@/lib/initiatives';
import { publicImageDataUri, renderEntityImage } from '@/lib/og/render';

export const alt = 'Initiative';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const initiative = await getInitiative(slug).catch(() => notFound());
  return renderEntityImage({
    title: initiative.title,
    description: initiative.tagline,
    meta:
      initiative.starts && initiative.ends
        ? formatRange(initiative.starts, initiative.ends, true)
        : undefined,
    brand: initiative.brand?.startsWith('#') ? initiative.brand : undefined,
    cover: await publicImageDataUri(initiative.cover?.src),
  });
}
