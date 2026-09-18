import { formatRange } from '@/components/initiatives/dates';

import { getPart } from '@/lib/initiatives';
import { publicImageDataUri, renderEntityImage } from '@/lib/og/render';

export const alt = 'Part of an initiative';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image(props: {
  params: Promise<{ slug: string; part: string }>;
}) {
  const { slug, part: partSlug } = await props.params;
  const found = await getPart(slug, partSlug);
  if (!found) {
    return renderEntityImage({ title: 'Not found' });
  }
  const { initiative, part } = found;
  return renderEntityImage({
    kicker: `${initiative.title} · ${initiative.partLabel} ${part.number}`,
    title: part.title,
    description: part.tagline ?? part.description,
    meta: `${formatRange(part.starts, part.ends, true)}${part.places.length ? ` · ${part.places.map((p) => p.name).join(', ')}` : ''}`,
    brand: initiative.brand?.startsWith('#') ? initiative.brand : undefined,
    cover: await publicImageDataUri(part.cover?.src ?? initiative.cover?.src),
  });
}
