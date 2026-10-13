import WebmentionSection, {
  hasVisibleWebmentions,
} from '@/components/indieweb/WebmentionSection';

import { publicWebmentionsForTarget } from '@/lib/indieweb/public-webmention-reads';
import type { WebmentionGroup } from '@/lib/indieweb/types';

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
  if (!webmentions || !hasVisibleWebmentions(webmentions)) return null;
  return (
    <section className={className} aria-label="Webmentions">
      <WebmentionSection webmentions={webmentions} />
    </section>
  );
}

/** A missing or unreachable database leaves the section empty. */
async function loadWebmentions(
  target: string
): Promise<WebmentionGroup | null> {
  try {
    return await publicWebmentionsForTarget(target);
  } catch {
    return null;
  }
}
