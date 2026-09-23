import { cacheLife } from 'next/cache';

import WebmentionSection from '@/components/indieweb/WebmentionSection';

import type { WebmentionGroup } from '@/lib/indieweb/types';
import { getWebmentionsForTarget } from '@/lib/indieweb/webmention-storage';

interface PageWebmentionsProps {
  /** The page's canonical URL, the target its mentions were sent to. */
  target: string;
  className?: string;
}

/**
 * Approved webmentions for a page other than a writing, such as an
 * initiative. Renders nothing until one is approved.
 */
export default async function PageWebmentions({
  target,
  className,
}: PageWebmentionsProps) {
  const webmentions = await loadWebmentions(target);
  if (!webmentions || !hasWebmentions(webmentions)) return null;
  return (
    <section className={className} aria-label="Webmentions">
      <WebmentionSection webmentions={webmentions} />
    </section>
  );
}

function hasWebmentions(group: WebmentionGroup): boolean {
  return Object.values(group).some((items) => items.length > 0);
}

/**
 * Cached for a minute, as on writings, so an approval shows without a
 * deploy and the section renders with the page rather than streaming in
 * after it. A missing or unreachable database resolves to nothing, since a
 * throw inside the cache scope fails the build.
 */
async function loadWebmentions(
  target: string
): Promise<WebmentionGroup | null> {
  'use cache';
  cacheLife('minutes');
  try {
    return await getWebmentionsForTarget(target);
  } catch {
    return null;
  }
}
