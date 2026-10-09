import { ComAtprotoRepoStrongRef } from '@atcute/atproto';
import { AppBskyFeedPost } from '@atcute/bluesky';
import { CODEC_RAW, fromString } from '@atcute/cid';
import { getPdsEndpoint } from '@atcute/identity';
import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver';
import {
  type Blob,
  type Did,
  type LegacyBlob,
  safeParse,
} from '@atcute/lexicons';

import { oauthFetch } from './oauth-fetch';

export interface CurrentResponseRecord {
  uri: string;
  cid: string;
  value: AppBskyFeedPost.Main;
  pds: string;
  legacyBlobCids?: readonly string[];
}
export type ResponseRecordReader = (
  uri: string
) => Promise<CurrentResponseRecord | null>;

interface KnownBlob {
  blob: Blob | LegacyBlob;
  mime: 'image/*' | 'video/mp4' | 'text/vtt';
  maximum: number;
}

function knownBlobs(record: AppBskyFeedPost.Main): KnownBlob[] {
  const embed = record.embed;
  const raw =
    embed?.$type === 'app.bsky.embed.recordWithMedia' ? embed.media : embed;
  switch (raw?.$type) {
    case 'app.bsky.embed.images':
      return raw.images.map((image) => ({
        blob: image.image,
        mime: 'image/*',
        maximum: 2000000,
      }));
    case 'app.bsky.embed.gallery':
      return raw.items.flatMap((item) =>
        item.$type === 'app.bsky.embed.gallery#image'
          ? [{ blob: item.image, mime: 'image/*' as const, maximum: 2000000 }]
          : []
      );
    case 'app.bsky.embed.video':
      return [
        { blob: raw.video, mime: 'video/mp4', maximum: 300000000 },
        ...(raw.captions ?? []).map((caption) => ({
          blob: caption.file,
          mime: 'text/vtt' as const,
          maximum: 20000,
        })),
      ];
    case 'app.bsky.embed.external':
      return raw.external.thumb
        ? [{ blob: raw.external.thumb, mime: 'image/*', maximum: 1000000 }]
        : [];
    default:
      return [];
  }
}

/** Legacy sizes remain unknown; only reader-normalized legacy refs may use -1. */
export function parseCurrentResponsePost(
  value: unknown,
  normalizedLegacyCids: readonly string[] = []
): { value: AppBskyFeedPost.Main; legacyBlobCids: string[] } {
  const parsed = safeParse(AppBskyFeedPost.mainSchema, value);
  if (!parsed.ok) throw new Error('The response PDS returned an invalid post.');
  const legacy = new Set<string>();
  // Inspect original known blob fields before the library normalizes old references.
  for (const { blob, mime, maximum } of knownBlobs(
    value as AppBskyFeedPost.Main
  )) {
    const cid = 'cid' in blob ? blob.cid : blob.ref.$link;
    if (fromString(cid).codec !== CODEC_RAW)
      throw new Error('The response media CID does not identify a raw blob.');
    const suppliedMime = blob.mimeType.toLowerCase();
    if (
      mime === 'image/*'
        ? !/^image\/[a-z0-9!#$&^_.+-]+$/.test(suppliedMime)
        : suppliedMime !== mime
    )
      throw new Error('The response media MIME type is invalid.');
    if ('cid' in blob) {
      legacy.add(cid);
    } else if (blob.size === -1 && normalizedLegacyCids.includes(cid)) {
      legacy.add(cid);
    } else if (
      !Number.isSafeInteger(blob.size) ||
      blob.size <= 0 ||
      blob.size > maximum
    ) {
      throw new Error('The response media size is invalid.');
    }
  }
  return { value: parsed.value, legacyBlobCids: [...legacy] };
}

/** Each refresh shares its deadline and DID resolutions across public record reads. */
export function createResponseRecordReader(
  signal: AbortSignal,
  fetcher: typeof fetch = oauthFetch
): ResponseRecordReader {
  const guardedFetch: typeof fetch = (input, init) =>
    fetcher(input, { ...init, signal });
  const resolver = new CompositeDidDocumentResolver({
    methods: {
      plc: new PlcDidDocumentResolver({ fetch: guardedFetch }),
      web: new WebDidDocumentResolver({ fetch: guardedFetch }),
    },
  });
  const endpoints = new Map<string, Promise<string>>();
  function endpoint(did: Did): Promise<string> {
    let pending = endpoints.get(did);
    if (!pending) {
      pending = resolver.resolve(did as Did<'plc' | 'web'>).then((document) => {
        if (document.id !== did) throw new Error('The response DID changed.');
        const pds = getPdsEndpoint(document);
        if (!pds) throw new Error('The response author has no PDS.');
        const url = new URL(pds);
        if (url.protocol !== 'https:' || url.username || url.password)
          throw new Error('Response records require public HTTPS.');
        return url.href;
      });
      endpoints.set(did, pending);
    }
    return pending;
  }
  return async (uri) => {
    signal.throwIfAborted();
    const match = /^at:\/\/(did:[^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(
      uri
    );
    if (!match) throw new Error('Invalid response record URI.');
    const pds = await endpoint(match[1] as Did);
    const url = new URL('/xrpc/com.atproto.repo.getRecord', pds);
    url.search = new URLSearchParams({
      repo: match[1],
      collection: 'app.bsky.feed.post',
      rkey: match[2],
    }).toString();
    const response = await guardedFetch(url);
    const record = await response.json();
    if (
      (response.status === 400 || response.status === 404) &&
      record.error === 'RecordNotFound'
    )
      return null;
    if (!response.ok) throw new Error('The response PDS is unavailable.');
    if (
      record.uri !== uri ||
      !safeParse(ComAtprotoRepoStrongRef.mainSchema, {
        uri: record.uri,
        cid: record.cid,
      }).ok
    )
      throw new Error('The response PDS returned another record.');
    const parsed = parseCurrentResponsePost(record.value);
    return {
      uri,
      cid: record.cid,
      value: parsed.value,
      pds,
      ...(parsed.legacyBlobCids.length && {
        legacyBlobCids: parsed.legacyBlobCids,
      }),
    };
  };
}
