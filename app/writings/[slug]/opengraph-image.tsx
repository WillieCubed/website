import { notFound } from 'next/navigation';

import { publicImageDataUri, renderEntityImage } from '@/lib/seo/og/render';
import { formatDate } from '@/lib/site/dates';
import { getPublishedWriting } from '@/lib/writings/index';

export const alt = 'Writing';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Render a PNG social preview with the published writing title, description,
 * date, reading time, and available cover. Return 404 for a draft or missing
 * writing.
 */
export default async function Image(
  props: Pick<PageProps<'/writings/[slug]'>, 'params'>
) {
  const { slug } = await props.params;
  const { writing } = await getPublishedWriting(slug).catch(() => notFound());
  return renderEntityImage({
    title: writing.title,
    description: writing.description,
    meta: `${formatDate(new Date(writing.published))} · ${writing.readingTime} min read`,
    cover: await publicImageDataUri(writing.featuredImage),
  });
}
