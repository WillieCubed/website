'use client';
import SiteLink from '@/components/link/SiteLink';
import Button from '@/components/site/Button';

import { site } from '@/lib/site/identity';
import type { Draft, Publication } from '@/lib/studio/types';

export default function WritingPublicationNotice({
  draft,
  publicationConnectionError,
  publication,
  busy,
  generatePreview,
}: {
  draft: Draft;
  publicationConnectionError: string;
  publication: Publication | null;
  busy: boolean;
  generatePreview: (
    mode: 'read' | 'portable',
    publishing?: boolean
  ) => Promise<void>;
}) {
  if (!publication) return null;
  return (
    <section className="studio-notice" role="status">
      <h2 className="text-title-large">
        {publicationHeading(publication.status)}
      </h2>
      <p>
        {publication.error ||
          (publication.status === 'live'
            ? 'The published revision is available on your site.'
            : 'You can keep writing while this revision publishes.')}
      </p>
      {publicationConnectionError && <p>{publicationConnectionError}</p>}
      {publication.pullRequestUrl && publication.status !== 'live' && (
        <SiteLink href={publication.pullRequestUrl}>
          View publication checks
        </SiteLink>
      )}
      {publication.status === 'failed' && (
        <Button
          disabled={busy}
          onClick={() => void generatePreview('read', true)}
        >
          Review and retry publication
        </Button>
      )}
      {publication.status === 'live' && (
        <SiteLink href={`${site.origin}/writings/${draft.slug}`}>
          Read published writing →
        </SiteLink>
      )}
    </section>
  );
}

function publicationHeading(status: string): string {
  const headings: Record<string, string> = {
    live: 'Your writing is live',
    failed: 'Publication needs attention',
    deploying: 'Deploying your writing…',
  };
  return headings[status] ?? 'Publishing your revision…';
}
