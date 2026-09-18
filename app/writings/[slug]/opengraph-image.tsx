import { publicImageDataUri, renderEntityImage } from '@/lib/og/render';
import { formatDate } from '@/lib/site';
import { getWriting } from '@/lib/writings';

export const alt = 'Writing';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const { writing } = await getWriting(slug);
  return renderEntityImage({
    title: writing.title,
    description: writing.description,
    meta: `${formatDate(new Date(writing.published))} · ${writing.readingTime} min read`,
    cover: await publicImageDataUri(writing.featuredImage),
  });
}
