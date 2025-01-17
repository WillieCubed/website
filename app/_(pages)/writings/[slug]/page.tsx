import { redirect } from 'next/navigation';
import { Metadata } from 'next/types';

import { WritingData, getWriting } from '@/lib/writings';

import WritingDetailsView from './WritingDetailsView';

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/writings`
  : 'https://williecubed.me/writings';

/**
 * Generate a canonical URL for a project's meta social information.
 */
function generateProjectUrl(slug: string) {
  return `${BASE_URL}/${slug}`;
}

export const dynamic = 'force-static';

/**
 * Head for the /writings/[slug] route.
 *
 * This injects OpenGraph tags with information specific to the writing
 * with the given slug.
 */
export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const { slug } = params;
  const { writing } = await getWriting(slug);
  const canonicalUrl = generateProjectUrl(writing.slug);
  return {
    title: writing.title,
    description: writing.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'article',
      title: writing.title,
      description: writing.description,
      publishedTime: writing.published.toISOString(),
      modifiedTime: writing.lastUpdated.toISOString(),
      url: canonicalUrl,
      // TODO: Choose a different image for a project
    },
  };
}

interface WritingDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function WritingDetailPage(props: WritingDetailPageProps) {
  const params = await props.params;

  const { slug } = params;

  let mdxSource, writing;
  try {
    const writingData = await getWriting(slug);
    mdxSource = writingData.mdxSource;
    writing = writingData.writing as WritingData;
  } catch (e) {
    return redirect('/404');
  }

  const formattedPublishDate = new Date(writing.published).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );
  const formattedLastUpdatedDate = new Date(
    writing.lastUpdated
  ).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-breakpoint-2xl mx-auto tablet:grid-cols-8 space-y-lg">
      <section className="pt-[64px] pb-lg max-w-breakpoint-md mx-auto px-lg desktop:px-0 tablet:col-start-1 tablet:col-span-8">
        <div className="space-y-md">
          <div className="text-headline-medium desktop:text-headline-large">
            {writing.title}
          </div>
          <div className="mt-xl text-primary text-title-large">
            {writing.description}
          </div>
          <div className="mt-xl text-label-large">
            Originally shared {formattedPublishDate}
          </div>
        </div>
      </section>
      <main className="pb-12 tablet:pb-16 max-w-breakpoint-md mx-auto px-lg desktop:px-0 tablet:col-start-1 tablet:col-span-8">
        <WritingDetailsView
          compiledSource={mdxSource.compiledSource}
          scope={mdxSource.scope}
          frontmatter={mdxSource.frontmatter}
        />
      </main>
    </div>
  );
}
