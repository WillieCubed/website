import { publicImageDataUri, renderEntityImage } from '@/lib/og/render';
import { getWriting } from '@/lib/writings';

export const alt = 'Writing';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export default async function Image(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const { writing } = await getWriting(slug);
  return renderEntityImage({
    kind: writing.postType === 'article' ? 'Writing' : writing.postType,
    title: writing.title,
    description: writing.description,
    meta: `${dateFormat.format(new Date(writing.published))} · ${writing.readingTime} min read`,
    cover: await publicImageDataUri(writing.featuredImage),
  });
}
