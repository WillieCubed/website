import assert from 'node:assert/strict';
import type { DefaultTreeAdapterTypes } from 'parse5';

import type {
  RepoRecord,
  RepoRecordReference,
} from '../../../../lib/atproto/types';

export interface PublishedWritingVerification {
  status: 'passed';
  checkedAt: string;
  origin: string;
  publication: RepoRecordReference;
  document: RepoRecordReference;
  independentValidator: string;
}

interface VerificationContext {
  slug: string;
  ORIGIN: string;
  publicationUri: string;
  publicationRkey: string;
  PUBLICATION_COLLECTION: string;
  DOCUMENT_COLLECTION: string;
  publicRecord: (collection: string, rkey: string) => Promise<RepoRecord>;
  progress: { verificationPhase: string };
}
async function html(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  assert(
    response.ok,
    `Public verification request failed (${response.status}).`
  );
  return response.text();
}

export async function verifyPublishedWriting({
  slug,
  ORIGIN,
  publicationUri,
  publicationRkey,
  PUBLICATION_COLLECTION,
  DOCUMENT_COLLECTION,
  publicRecord,
  progress,
}: VerificationContext): Promise<PublishedWritingVerification> {
  progress.verificationPhase = 'verification slug validation';
  assert(/^[a-z0-9-]+$/.test(slug), 'Verification requires a writing slug.');
  progress.verificationPhase = 'verification module loading';
  const [{ loadWriting }, { documentRkey }, verification, { parse }] =
    await Promise.all([
      import('../../../../lib/writings/load'),
      import('../../../../lib/atproto/keys'),
      import('../../../../lib/atproto/verification'),
      import('parse5'),
    ]);
  progress.verificationPhase = 'published writing source loading';
  const { writing } = await loadWriting(slug);
  assert(!writing.draft, 'A draft cannot be verified as published.');
  const path = `/writings/${slug}`;
  progress.verificationPhase = 'public publication PDS HTTP read';
  const publication = await publicRecord(
    PUBLICATION_COLLECTION,
    publicationRkey
  );
  progress.verificationPhase =
    'public publication verification endpoint HTTP read';
  const endpoint = await html(
    `${ORIGIN}/.well-known/site.standard.publication`
  );
  progress.verificationPhase = 'public document PDS HTTP read';
  const document = await publicRecord(
    DOCUMENT_COLLECTION,
    documentRkey(path, writing.published)
  );
  progress.verificationPhase = 'public writing page HTTP read';
  const page = await html(ORIGIN + path);
  progress.verificationPhase = 'publication record and endpoint agreement';
  assert(
    verification.publicationIsVerified(
      publication.value,
      ORIGIN,
      publicationUri,
      endpoint
    ),
    'The publication record must be valid and match the site origin and public verification endpoint.'
  );
  progress.verificationPhase = 'writing document head link retention';
  assert(
    verification.hasDocumentVerification(page, document.uri),
    'The writing head must retain its exact document verification link.'
  );
  progress.verificationPhase =
    'document record and writing verification agreement';
  assert(
    verification.documentIsVerified(
      document.value,
      publicationUri,
      path,
      document.uri,
      page
    ),
    'The document record must be valid and match the publication, writing path and document verification link.'
  );
  progress.verificationPhase = 'writing publication head link retention';
  assertPublicationHeadLink(parse(page), publicationUri);
  return {
    status: 'passed',
    checkedAt: new Date().toISOString(),
    origin: ORIGIN,
    publication: { uri: publication.uri, cid: publication.cid },
    document: { uri: document.uri, cid: document.cid },
    independentValidator:
      'pending: use the authorized browser; this script does not access or replace site-validator.fly.dev',
  };
}

function assertPublicationHeadLink(
  tree: DefaultTreeAdapterTypes.Document,
  publicationUri: string
): void {
  const head = tree.childNodes.find((node) => node.nodeName === 'html');
  const headNode =
    head && 'childNodes' in head
      ? head.childNodes.find((node) => node.nodeName === 'head')
      : undefined;
  assert(
    headNode &&
      'childNodes' in headNode &&
      headNode.childNodes.some(
        (node) =>
          'attrs' in node &&
          node.nodeName === 'link' &&
          node.attrs.some(
            (attr) =>
              attr.name === 'rel' &&
              attr.value.split(/\s+/).includes('site.standard.publication')
          ) &&
          node.attrs.some(
            (attr) => attr.name === 'href' && attr.value === publicationUri
          )
      ),
    'The writing head must retain its publication verification link.'
  );
}
