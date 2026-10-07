import type { Did } from '@atcute/lexicons';
import * as TID from '@atcute/tid';

import { site } from '../site';

/**
 * Server-only AT Protocol settings. With lib/site.ts, this is the only
 * module that reads the environment; everything else asks it.
 */

/** The account every record lives in: the DID /.well-known/atproto-did serves. */
export const ATPROTO_DID = site.author.atprotoDid as Did | undefined;

export const PUBLICATION_COLLECTION = 'site.standard.publication';
export const DOCUMENT_COLLECTION = 'site.standard.document';
export type Collection =
  | typeof PUBLICATION_COLLECTION
  | typeof DOCUMENT_COLLECTION;

/**
 * The publication's record key: a TID generated once and kept in the
 * environment, so every page can name the record without asking the PDS.
 * Never change it: subscriptions and documents point at this URI.
 */
export const PUBLICATION_RKEY =
  process.env.ATPROTO_PUBLICATION_RKEY || undefined;
if (PUBLICATION_RKEY && !TID.validate(PUBLICATION_RKEY)) {
  throw new Error('ATPROTO_PUBLICATION_RKEY must be a TID.');
}

/** The publication's AT-URI, while both the DID and the key are set. */
export const PUBLICATION_URI: `at://${string}` | undefined =
  ATPROTO_DID && PUBLICATION_RKEY
    ? `at://${ATPROTO_DID}/${PUBLICATION_COLLECTION}/${PUBLICATION_RKEY}`
    : undefined;

/** What writing records needs; throws when the environment leaves it out. */
export function publishingIdentity(): {
  did: Did;
  publicationRkey: string;
  publicationUri: `at://${string}`;
} {
  if (!ATPROTO_DID || !PUBLICATION_RKEY || !PUBLICATION_URI) {
    throw new Error(
      'Set NEXT_PUBLIC_ATPROTO_DID and ATPROTO_PUBLICATION_RKEY to publish.'
    );
  }
  return {
    did: ATPROTO_DID,
    publicationRkey: PUBLICATION_RKEY,
    publicationUri: PUBLICATION_URI,
  };
}

/** The app password the sync signs in with; set on Production only. */
export function appPassword(): string | undefined {
  return process.env.ATPROTO_APP_PASSWORD || undefined;
}

export function socialSettings() {
  const signingKey = process.env.ATPROTO_OAUTH_JWK;
  const storageKey = process.env.ATPROTO_OAUTH_STORAGE_KEY;
  if (
    !PUBLICATION_URI ||
    !signingKey ||
    !storageKey ||
    !process.env.POSTGRES_URL
  )
    return undefined;
  if (Buffer.from(storageKey, 'base64').length !== 32)
    throw new Error('ATPROTO_OAUTH_STORAGE_KEY must encode 32 bytes.');
  return { signingKey, storageKey };
}
