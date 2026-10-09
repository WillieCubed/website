import { ComAtprotoRepoStrongRef } from '@atcute/atproto';
import { AppBskyFeedPost } from '@atcute/bluesky';
import { type Did, safeParse } from '@atcute/lexicons';
import { SiteStandardDocument } from '@atcute/standard-site';

import { absoluteUrl, site } from '@/lib/site';
import { clipText } from '@/lib/text/clip';
import { writingText } from '@/lib/writings/content';

import { blueskyAppview, publishingIdentity } from './config';
import { resolvePds } from './identity';
import { documentRkey } from './keys';
import { oauthFetch } from './oauth-fetch';
import type { DocumentSource } from './records';
import type { RepoClient } from './types';

function blueskyServiceUrl(): string {
  const base =
    site.syndication.find((entry) => entry.service === 'Bluesky')?.serviceUrl ??
    'https://bsky.app/';
  return base.endsWith('/') ? base : base + '/';
}
export function blueskyProfileUrl(actor: string): string {
  return new URL(
    `profile/${encodeURIComponent(actor).replace(/%3A/gi, ':')}`,
    blueskyServiceUrl()
  ).href;
}
export function blueskyPostUrl(uri: string): string {
  const parsed = /^at:\/\/(did:[^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(
    uri
  );
  if (!parsed) throw new Error('Invalid Bluesky post URI.');
  return `${blueskyProfileUrl(parsed[1])}/post/${encodeURIComponent(parsed[2])}`;
}
export function blueskyHandlePostUrl(actor: string, rkey: string): string {
  return `${blueskyProfileUrl(actor)}/post/${encodeURIComponent(rkey)}`;
}

export function parseBlueskyPostUrl(
  value: string
): { actor: string; rkey: string } | null {
  try {
    const url = new URL(value);
    const service = new URL(blueskyServiceUrl());
    const match =
      url.pathname.startsWith(service.pathname) &&
      /^profile\/([^/]+)\/post\/([^/]+)\/?$/.exec(
        url.pathname.slice(service.pathname.length)
      );
    return url.protocol === 'https:' &&
      url.origin === service.origin &&
      !url.username &&
      !url.password &&
      match
      ? {
          actor: decodeURIComponent(match[1]),
          rkey: decodeURIComponent(match[2]),
        }
      : null;
  } catch {
    return null;
  }
}

export async function publicRecord(uri: string): Promise<{
  uri: string;
  cid: string;
  value: Record<string, unknown>;
} | null> {
  const match = /^at:\/\/(did:[^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!match) return null;
  const url = new URL(
    '/xrpc/com.atproto.repo.getRecord',
    await resolvePds(match[1] as Did)
  );
  url.search = new URLSearchParams({
    repo: match[1],
    collection: match[2],
    rkey: match[3],
  }).toString();
  const response = await oauthFetch(url);
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok)
    throw new Error(`PDS record fetch failed (${response.status}).`);
  return response.json();
}

interface CopyRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}
export interface BlueskyCopyResult {
  action: 'create' | 'associate' | 'recover';
  url: string;
  post: { uri: string; cid: string } | null;
}
function assertCopyRecord(
  record: CopyRecord,
  canonical: string,
  expectedUri?: string
): void {
  assertOwnerCopy(record);
  if (expectedUri && record.uri !== expectedUri)
    throw new Error('The copy record has an unexpected identity.');
  if (
    record.value.$type !== 'app.bsky.feed.post' ||
    !safeParse(AppBskyFeedPost.mainSchema, record.value, { strict: true }).ok
  )
    throw new Error('The copy must contain a valid Bluesky feed post.');
  const post = record.value as {
    embed?: {
      $type?: string;
      external?: { uri?: string };
      media?: { $type?: string; external?: { uri?: string } };
    };
    text: string;
    facets?: {
      index: { byteStart: number; byteEnd: number };
      features?: { $type?: string; uri?: string }[];
    }[];
  };
  const embed =
    post.embed?.$type === 'app.bsky.embed.recordWithMedia'
      ? post.embed.media
      : post.embed;
  const external =
    embed?.$type === 'app.bsky.embed.external' &&
    embed.external?.uri === canonical;
  const textBytes = new TextEncoder().encode(post.text);
  const facet = post.facets?.some(
    (facet) =>
      facet.index.byteStart < facet.index.byteEnd &&
      facet.index.byteEnd <= textBytes.length &&
      facet.features?.some(
        (feature) =>
          feature.$type === 'app.bsky.richtext.facet#link' &&
          feature.uri === canonical
      )
  );
  if (!external && !facet)
    throw new Error('The Bluesky copy must link to the canonical writing.');
}

export async function validateExplicitBlueskyCopies(
  client: RepoClient,
  sources: DocumentSource[]
): Promise<void> {
  for (const source of sources) {
    const ref = source.atproto?.bskyPostRef;
    if (!ref) continue;
    assertOwnerCopy(ref);
    if (!client.getRecord)
      throw new Error('The publishing client cannot validate Bluesky copies.');
    const record = await client.getRecord(
      'app.bsky.feed.post',
      ref.uri.split('/').at(-1)!
    );
    if (!record)
      throw new Error('The explicit Bluesky copy could not be resolved.');
    assertCopyRecord(record, absoluteUrl(`/writings/${source.slug}`), ref.uri);
    if (record.cid !== ref.cid)
      throw new Error(
        'The explicit Bluesky copy refers to an outdated record.'
      );
  }
}
async function resolveCopy(
  client: RepoClient,
  url: string,
  canonical: string
): Promise<{ uri: string; cid: string } | null> {
  const copy = parseBlueskyPostUrl(url);
  if (!copy) return null;
  let did = copy.actor;
  if (!did.startsWith('did:')) {
    const address = new URL(
      '/xrpc/com.atproto.identity.resolveHandle',
      blueskyAppview()
    );
    address.searchParams.set('handle', did);
    const response = await oauthFetch(address);
    if (!response.ok) return null;
    did = (await response.json()).did;
  }
  if (did !== publishingIdentity().did)
    throw new Error('A syndication copy must belong to the publication owner.');
  const record = await client.getRecord!('app.bsky.feed.post', copy.rkey);
  if (!record) return null;
  assertCopyRecord(
    record,
    canonical,
    `at://${did}/app.bsky.feed.post/${copy.rkey}`
  );
  return { uri: record.uri, cid: record.cid };
}

/** A deterministic post key recovers an announcement if its later document update failed. */
export async function syncBlueskyCopies(
  client: RepoClient,
  sources: DocumentSource[],
  options: { dryRun?: boolean } = {}
): Promise<BlueskyCopyResult[]> {
  const results: BlueskyCopyResult[] = [];
  const account = site.syndication.find((entry) => entry.service === 'Bluesky');
  if (!account) return results;
  await validateExplicitBlueskyCopies(client, sources);
  for (const source of sources) {
    const listed = source.syndication?.find((copy) =>
      parseBlueskyPostUrl(copy.url)
    );
    const requested = source.syndicateTo?.includes(account.profile);
    if (!listed && !requested) continue;
    if (
      !client.getRecord ||
      (!options.dryRun && (!client.createRecord || !client.putRecord))
    )
      throw new Error(
        'The publishing client cannot synchronize Bluesky copies.'
      );
    const path = `/writings/${source.slug}`;
    const canonical = absoluteUrl(path);
    const rkey = documentRkey(path, source.published);
    const postUri = `at://${publishingIdentity().did}/app.bsky.feed.post/${rkey}`;
    const document = await client.getRecord('site.standard.document', rkey);
    if (!document && !options.dryRun)
      throw new Error(
        'Publish the Standard.site document before syndicating it.'
      );
    if (document?.value.bskyPostRef) {
      assertOwnerCopy(document.value.bskyPostRef);
      continue;
    }
    if (source.atproto?.bskyPostRef === null) continue;
    let copy: { uri: string; cid: string } | null = null;
    let action: BlueskyCopyResult['action'];
    if (listed) {
      copy = await resolveCopy(client, listed.url, canonical);
      if (!copy)
        throw new Error('The listed Bluesky copy could not be resolved.');
      action = 'associate';
    } else {
      const existing = await client.getRecord('app.bsky.feed.post', rkey);
      if (existing) {
        try {
          assertCopyRecord(existing, canonical, postUri);
        } catch (error) {
          throw new Error(
            'The announcement key already belongs to another post.',
            { cause: error }
          );
        }
        copy = { uri: existing.uri, cid: existing.cid };
        action = 'recover';
      } else {
        action = 'create';
        if (!options.dryRun) {
          const publication = await client.getRecord(
            'site.standard.publication',
            publishingIdentity().publicationRkey
          );
          if (!publication)
            throw new Error('The publication record is missing.');
          const record = {
            $type: 'app.bsky.feed.post',
            text: clipText(
              source.hasExplicitTitle === false
                ? writingText(source.body, source)
                : source.title,
              300,
              3000
            ),
            createdAt: source.published.toISOString(),
            langs: [site.language],
            embed: {
              $type: 'app.bsky.embed.external',
              external: {
                uri: canonical,
                title: source.title,
                description: source.description,
                ...(document!.value.coverImage
                  ? { thumb: document!.value.coverImage }
                  : {}),
                associatedRefs: [
                  { uri: document!.uri, cid: document!.cid },
                  { uri: publication.uri, cid: publication.cid },
                ],
              },
            },
          };
          const checked = safeParse(AppBskyFeedPost.mainSchema, record, {
            strict: true,
          });
          if (!checked.ok)
            throw new Error(`Invalid Bluesky announcement: ${checked.message}`);
          try {
            copy = await client.createRecord!(
              'app.bsky.feed.post',
              rkey,
              record
            );
            assertOwnerCopy(copy);
            if (copy.uri !== postUri)
              throw new Error('The created copy has an unexpected identity.');
          } catch (error) {
            const recovered = await client.getRecord(
              'app.bsky.feed.post',
              rkey
            );
            if (!recovered) throw error;
            assertCopyRecord(recovered, canonical, postUri);
            copy = { uri: recovered.uri, cid: recovered.cid };
            action = 'recover';
          }
        }
      }
    }
    if (!options.dryRun) {
      try {
        await client.putRecord!(
          'site.standard.document',
          rkey,
          { ...document!.value, bskyPostRef: copy },
          document!.cid
        );
      } catch (error) {
        let associated = false;
        try {
          const current = await client.getRecord(
            'site.standard.document',
            rkey
          );
          const ref = current?.value.bskyPostRef as
            | { uri?: unknown; cid?: unknown }
            | undefined;
          associated = Boolean(
            current &&
            current.uri ===
              `at://${publishingIdentity().did}/site.standard.document/${rkey}` &&
            current.value.site === publishingIdentity().publicationUri &&
            safeParse(SiteStandardDocument.mainSchema, current.value, {
              strict: true,
            }).ok &&
            ref?.uri === copy?.uri &&
            ref?.cid === copy?.cid
          );
        } catch {
          // A failed recovery read cannot establish that the intended association exists.
        }
        // A concurrent publisher may have associated this exact copy before our CID swap.
        // Preserve its authored fields rather than retrying an overwrite with a newer CID.
        if (!associated) throw error;
      }
    }
    results.push({
      action,
      url: canonical,
      post: options.dryRun ? null : copy,
    });
  }
  return results;
}

export function assertOwnerCopy(
  ref: unknown
): asserts ref is { uri: string; cid: string } {
  const copy = ref as { uri?: unknown; cid?: unknown };
  if (
    typeof copy?.uri !== 'string' ||
    !copy.uri.startsWith(
      `at://${publishingIdentity().did}/app.bsky.feed.post/`
    ) ||
    !/^at:\/\/did:[^/]+\/app\.bsky\.feed\.post\/[^/]+$/.test(copy.uri) ||
    typeof copy.cid !== 'string' ||
    !safeParse(
      ComAtprotoRepoStrongRef.mainSchema,
      { uri: copy.uri, cid: copy.cid },
      { strict: true }
    ).ok
  ) {
    throw new Error(
      'A Bluesky copy must identify a post owned by the publication account.'
    );
  }
}
