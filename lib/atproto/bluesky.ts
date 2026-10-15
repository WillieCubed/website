import { AppBskyFeedPost } from '@atcute/bluesky';
import { type Did, safeParse } from '@atcute/lexicons';
import { SiteStandardDocument } from '@atcute/standard-site';

import { site } from '@/lib/site/identity';
import { absoluteUrl } from '@/lib/site/urls';
import { clipText } from '@/lib/text/clip';
import { writingText } from '@/lib/writings/content';

import { blueskyAppview, publishingIdentity } from './config';
import { resolvePds } from './identity';
import { documentRkey } from './keys';
import { oauthFetch } from './oauth-fetch';
import { assertOwnerCopy } from './owner-copy';
import type { DocumentSource } from './records';
import type { RepoClient, RepoRecord, RepoRecordReference } from './types';

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

export async function publicRecord(
  uri: string,
  signal?: AbortSignal
): Promise<RepoRecord | null> {
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
  signal?.throwIfAborted();
  const response = await oauthFetch(url, { signal });
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok)
    throw new Error(`PDS record fetch failed (${response.status}).`);
  return response.json();
}

export interface BlueskyCopyResult {
  action: 'create' | 'associate' | 'recover';
  url: string;
  post: RepoRecordReference | null;
}
function assertCopyRecord(
  record: RepoRecord,
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
  if (!linksCanonical(record.value as LinkedPost, canonical))
    throw new Error('The Bluesky copy must link to the canonical writing.');
}

type LinkedPost = {
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

function linksCanonical(post: LinkedPost, canonical: string): boolean {
  const embed =
    post.embed?.$type === 'app.bsky.embed.recordWithMedia'
      ? post.embed.media
      : post.embed;
  const external =
    embed?.$type === 'app.bsky.embed.external' &&
    embed.external?.uri === canonical;
  if (external) return true;
  const textBytes = new TextEncoder().encode(post.text);
  return Boolean(
    post.facets?.some(
      (facet) =>
        facet.index.byteStart < facet.index.byteEnd &&
        facet.index.byteEnd <= textBytes.length &&
        facet.features?.some(
          (feature) =>
            feature.$type === 'app.bsky.richtext.facet#link' &&
            feature.uri === canonical
        )
    )
  );
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
): Promise<RepoRecordReference | null> {
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

type CopyReader = RepoClient & Required<Pick<RepoClient, 'getRecord'>>;
interface CopyTarget {
  rkey: string;
  canonical: string;
  postUri: string;
  document: RepoRecord | null;
}
interface SelectedCopy {
  action: BlueskyCopyResult['action'];
  post: RepoRecordReference | null;
}

function assertCopyClient(
  client: RepoClient,
  dryRun: boolean
): asserts client is CopyReader {
  if (
    !client.getRecord ||
    (!dryRun && (!client.createRecord || !client.putRecord))
  )
    throw new Error('The publishing client cannot synchronize Bluesky copies.');
}

function announcement(
  source: DocumentSource,
  target: CopyTarget,
  publication: RepoRecord
) {
  const document = target.document!;
  return {
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
        uri: target.canonical,
        title: source.title,
        description: source.description,
        ...(document.value.coverImage
          ? { thumb: document.value.coverImage }
          : {}),
        associatedRefs: [
          { uri: document.uri, cid: document.cid },
          { uri: publication.uri, cid: publication.cid },
        ],
      },
    },
  };
}

async function createAnnouncement(
  client: CopyReader,
  source: DocumentSource,
  target: CopyTarget
): Promise<SelectedCopy> {
  const publication = await client.getRecord(
    'site.standard.publication',
    publishingIdentity().publicationRkey
  );
  if (!publication) throw new Error('The publication record is missing.');
  const record = announcement(source, target, publication);
  const checked = safeParse(AppBskyFeedPost.mainSchema, record, {
    strict: true,
  });
  if (!checked.ok)
    throw new Error(`Invalid Bluesky announcement: ${checked.message}`);
  try {
    const post = await client.createRecord!(
      'app.bsky.feed.post',
      target.rkey,
      record
    );
    assertOwnerCopy(post);
    if (post.uri !== target.postUri)
      throw new Error('The created copy has an unexpected identity.');
    return { action: 'create', post };
  } catch (error) {
    const recovered = await client.getRecord('app.bsky.feed.post', target.rkey);
    if (!recovered) throw error;
    assertCopyRecord(recovered, target.canonical, target.postUri);
    return {
      action: 'recover',
      post: { uri: recovered.uri, cid: recovered.cid },
    };
  }
}

async function selectCopy(
  client: CopyReader,
  source: DocumentSource,
  target: CopyTarget,
  listedUrl: string | undefined,
  dryRun: boolean
): Promise<SelectedCopy> {
  if (listedUrl) {
    const post = await resolveCopy(client, listedUrl, target.canonical);
    if (!post)
      throw new Error('The listed Bluesky copy could not be resolved.');
    return { action: 'associate', post };
  }
  const existing = await client.getRecord('app.bsky.feed.post', target.rkey);
  if (existing) {
    try {
      assertCopyRecord(existing, target.canonical, target.postUri);
    } catch (error) {
      throw new Error('The announcement key already belongs to another post.', {
        cause: error,
      });
    }
    return {
      action: 'recover',
      post: { uri: existing.uri, cid: existing.cid },
    };
  }
  if (dryRun) return { action: 'create', post: null };
  return createAnnouncement(client, source, target);
}

function matchesAssociation(
  record: RepoRecord | null,
  target: CopyTarget,
  post: RepoRecordReference
): boolean {
  if (!record) return false;
  const identity = publishingIdentity();
  if (
    record.uri !==
      `at://${identity.did}/site.standard.document/${target.rkey}` ||
    record.value.site !== identity.publicationUri
  )
    return false;
  if (
    !safeParse(SiteStandardDocument.mainSchema, record.value, { strict: true })
      .ok
  )
    return false;
  const ref = record.value.bskyPostRef as
    | Partial<RepoRecordReference>
    | undefined;
  return ref?.uri === post.uri && ref?.cid === post.cid;
}

async function associateCopy(
  client: CopyReader,
  target: CopyTarget,
  post: RepoRecordReference
): Promise<void> {
  const document = target.document!;
  try {
    await client.putRecord!(
      'site.standard.document',
      target.rkey,
      { ...document.value, bskyPostRef: post },
      document.cid
    );
  } catch (error) {
    let associated = false;
    try {
      associated = matchesAssociation(
        await client.getRecord('site.standard.document', target.rkey),
        target,
        post
      );
    } catch {
      // A failed recovery read cannot establish that the intended association exists.
    }
    // A concurrent publisher may have associated this exact copy before our CID swap.
    // Preserve its authored fields rather than retrying an overwrite with a newer CID.
    if (!associated) throw error;
  }
}

async function syncCopy(
  client: CopyReader,
  source: DocumentSource,
  listedUrl: string | undefined,
  dryRun: boolean
): Promise<BlueskyCopyResult | null> {
  const path = `/writings/${source.slug}`;
  const rkey = documentRkey(path, source.published);
  const document = await client.getRecord('site.standard.document', rkey);
  if (!document && !dryRun)
    throw new Error(
      'Publish the Standard.site document before syndicating it.'
    );
  if (document?.value.bskyPostRef) {
    assertOwnerCopy(document.value.bskyPostRef);
    return null;
  }
  if (source.atproto?.bskyPostRef === null) return null;
  const target: CopyTarget = {
    rkey,
    canonical: absoluteUrl(path),
    postUri: `at://${publishingIdentity().did}/app.bsky.feed.post/${rkey}`,
    document,
  };
  const selected = await selectCopy(client, source, target, listedUrl, dryRun);
  if (!dryRun) await associateCopy(client, target, selected.post!);
  return {
    action: selected.action,
    url: target.canonical,
    post: dryRun ? null : selected.post,
  };
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
    if (!listed && !source.syndicateTo?.includes(account.profile)) continue;
    assertCopyClient(client, Boolean(options.dryRun));
    const result = await syncCopy(
      client,
      source,
      listed?.url,
      Boolean(options.dryRun)
    );
    if (result) results.push(result);
  }
  return results;
}
