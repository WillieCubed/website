import { absoluteUrl, site } from '@/lib/site';
import { loadWriting } from '@/lib/writings';

import { publishingIdentity } from './config';
import { resolvePds } from './identity';
import { documentUri } from './keys';
import { oauthFetch } from './oauth-fetch';
import { documentPath } from './records';
import type { SocialAction } from './social';
import { SocialHttpError } from './social-http';
import { documentIsVerified, publicationIsVerified } from './verification';

async function record(uri: string): Promise<unknown> {
  const [, , did, collection, rkey] = uri.split('/');
  const pds = await resolvePds(did as Parameters<typeof resolvePds>[0]);
  const url = new URL('/xrpc/com.atproto.repo.getRecord', pds);
  url.search = new URLSearchParams({ repo: did, collection, rkey }).toString();
  const response = await oauthFetch(url);
  if (!response.ok)
    throw new SocialHttpError(
      'This publication has not finished syncing. Try again later.',
      409
    );
  return (await response.json()).value;
}

async function page(path: string): Promise<string> {
  const response = await oauthFetch(absoluteUrl(path));
  if (!response.ok)
    throw new SocialHttpError(
      'This publication could not be verified. Try again later.',
      409
    );
  return response.text();
}

export async function verifiedSocialTarget(
  action: SocialAction,
  slug?: string
): Promise<string> {
  const { publicationUri } = publishingIdentity();
  const publication = await record(publicationUri);
  if (
    !publicationIsVerified(
      publication,
      site.origin,
      publicationUri,
      await page('/.well-known/site.standard.publication')
    )
  )
    throw new SocialHttpError('This publication could not be verified.', 409);
  if (action === 'subscription') return publicationUri;
  if (!slug) throw new SocialHttpError('Choose a published writing.', 400);
  const loaded = await loadWriting(slug).catch(() => null);
  if (!loaded || loaded.writing.draft)
    throw new SocialHttpError('This writing is not published.', 404);
  const path = documentPath(slug);
  const uri = documentUri(path, loaded.writing.published);
  if (
    !uri ||
    !documentIsVerified(
      await record(uri),
      publicationUri,
      path,
      uri,
      await page(path)
    )
  )
    throw new SocialHttpError(
      'This writing has not finished syncing. Try again later.',
      409
    );
  return uri;
}
