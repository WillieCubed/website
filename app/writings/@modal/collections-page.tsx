import { redirect } from 'next/navigation';

import CollectionContent from '@/components/collections/CollectionContent';
import CollectionModal from '@/components/collections/CollectionModal';

import {
  findCollectionBySlug,
  getAllCollectionSlugs,
  getCollectionTypeDisplayName,
} from '@/lib/collections';
import { getSeriesWithWritings } from '@/lib/writings';

export async function generateStaticParams() {
  const allSlugs = await getAllCollectionSlugs();
  return allSlugs.map(({ slug }) => ({ slug }));
}

interface ModalCollectionPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Intercepting route for collections when navigating from within writings.
 * Displays the collection content in a modal overlay.
 */
export default async function ModalCollectionPage(
  props: ModalCollectionPageProps
) {
  const params = await props.params;
  const { slug } = params;

  const lookup = await findCollectionBySlug(slug);
  if (!lookup) {
    redirect('/404');
  }

  const { type } = lookup;
  const typeDisplayName = getCollectionTypeDisplayName(type);

  // For series, use the series-specific loader
  if (type === 'series') {
    let series;
    try {
      series = await getSeriesWithWritings(slug);
    } catch {
      redirect('/404');
    }

    return (
      <CollectionModal slug={slug}>
        <CollectionContent
          series={series}
          typeDisplayName={typeDisplayName}
          isModal
        />
      </CollectionModal>
    );
  }

  // Generic fallback for other collection types
  return (
    <CollectionModal slug={slug}>
      <div className="py-12 text-center text-body-medium text-on-surface-variant">
        This collection type is not yet implemented.
      </div>
    </CollectionModal>
  );
}
