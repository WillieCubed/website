import { ComAtprotoRepoStrongRef } from '@atcute/atproto';
import { AppBskyFeedPost } from '@atcute/bluesky';
import { safeParse } from '@atcute/lexicons';

import { absoluteUrl } from '@/lib/site';

import { publishingIdentity } from './config';
import type { DocumentSource } from './records';
import type { RepoClient } from './types';

interface CopyRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
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
