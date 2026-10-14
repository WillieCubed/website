'use client';

import SiteLink from '@/components/link/SiteLink';
import Button from '@/components/site/Button';

import { site } from '@/lib/site/identity';

import type { WritingController } from './useWritingController';

export default function WritingPublicationNotice({
  controller,
}: {
  controller: Pick<
    WritingController,
    | 'draft'
    | 'publicationConnectionError'
    | 'publication'
    | 'busy'
    | 'generatePreview'
  >;
}) {
  const {
    draft,
    publicationConnectionError,
    publication,
    busy,
    generatePreview,
  } = controller;
  return (
    <>
      {publication && (
        <section className="studio-notice" role="status">
          <h2 className="text-title-large">
            {publication.status === 'live'
              ? 'Your writing is live'
              : publication.status === 'failed'
                ? 'Publication needs attention'
                : publication.status === 'deploying'
                  ? 'Deploying your writing…'
                  : 'Publishing your revision…'}
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
      )}
    </>
  );
}
