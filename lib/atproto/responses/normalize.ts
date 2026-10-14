import { AppBskyFeedPost } from '@atcute/bluesky';
import type { Blob, LegacyBlob } from '@atcute/lexicons';
import { safeParse } from '@atcute/lexicons';

import {
  blueskyHandlePostUrl,
  blueskyPostUrl,
  blueskyProfileUrl,
} from '@/lib/atproto/bluesky';
import { type CurrentResponseRecord } from '@/lib/atproto/response-records';
import type { Post, Profile } from '@/lib/atproto/responses/types';
import type {
  PublishingResponse,
  ResponseMedia,
} from '@/lib/indieweb/webmention/types';

export function allowed(value: {
  labels?: Profile['labels'];
  viewer?: Profile['viewer'];
}): boolean {
  return (
    !!value &&
    !value.viewer?.blockedBy &&
    !value.viewer?.blocking &&
    !value.labels?.some(
      (label) =>
        !label.neg &&
        new Set([
          '!hide',
          '!warn',
          'porn',
          'sexual',
          'nudity',
          'graphic-media',
          'gore',
        ]).has(label.val)
    )
  );
}
function webUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function validProfile(profile: Profile): boolean {
  return (
    !!profile &&
    typeof profile.did === 'string' &&
    /^did:[a-z]+:[^/]+$/.test(profile.did) &&
    typeof profile.handle === 'string' &&
    !!profile.handle
  );
}
export function author(profile: Profile) {
  return {
    name: profile.displayName || profile.handle,
    url: blueskyProfileUrl(profile.did),
    photo: webUrl(profile.avatar),
  };
}
function media(embed: Post['embed']): ResponseMedia[] {
  if (!embed) return [];
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view')
    return media(embed.media);
  if (embed.$type === 'app.bsky.embed.gallery#view')
    return (embed.items ?? []).flatMap((item) => {
      const url =
        item.$type === 'app.bsky.embed.gallery#viewImage'
          ? webUrl(item.fullsize)
          : undefined;
      return url
        ? [{ kind: 'image' as const, url, description: item.alt }]
        : [];
    });
  if (embed.$type === 'app.bsky.embed.images#view')
    return (embed.images ?? []).flatMap((image) => {
      const url = webUrl(image.fullsize);
      return url
        ? [{ kind: 'image' as const, url, description: image.alt }]
        : [];
    });
  if (embed.$type === 'app.bsky.embed.video#view') {
    const url = webUrl(embed.playlist);
    return url
      ? [
          {
            kind: 'video',
            url,
            description: embed.alt,
            poster: webUrl(embed.thumbnail),
          },
        ]
      : [];
  }
  if (embed.$type === 'app.bsky.embed.external#view') {
    const url = webUrl(embed.external?.uri);
    return url
      ? [{ kind: 'file', url, description: embed.external?.title }]
      : [];
  }
  return [];
}
export function normalizeBlueskyPost(
  post: Post,
  target: string,
  type: 'reply' | 'mention',
  hidden: Set<string> = new Set()
): PublishingResponse | null {
  if (
    !validProfile(post?.author) ||
    !safeParse(AppBskyFeedPost.mainSchema, post.record).ok ||
    !Number.isFinite(Date.parse(post.indexedAt)) ||
    !/^at:\/\/did:[^/]+\/app\.bsky\.feed\.post\/[^/]+$/.test(post.uri)
  )
    return null;
  if (hidden.has(post.uri) || !allowed(post) || !allowed(post.author))
    return null;
  return {
    id: post.uri,
    sourceUrl: blueskyPostUrl(post.uri),
    targetUrl: target,
    type,
    origin: 'atproto',
    sourceAliases: [
      blueskyHandlePostUrl(post.author.handle, post.uri.split('/').at(-1)!),
    ],
    author: author(post.author),
    content: post.record.text,
    publishedAt: post.record.createdAt
      ? new Date(post.record.createdAt)
      : undefined,
    receivedAt: new Date(post.indexedAt),
    media: media(post.embed),
    parentUrl:
      post.record.reply?.parent?.uri &&
      /^at:\/\/did:[^/]+\/app\.bsky\.feed\.post\/[^/]+$/.test(
        post.record.reply.parent.uri
      )
        ? blueskyPostUrl(post.record.reply.parent.uri)
        : undefined,
  };
}
export function currentMediaView(
  current: CurrentResponseRecord
): Post['embed'] {
  function blobUrl(blob: Blob | LegacyBlob): string {
    const url = new URL('/xrpc/com.atproto.sync.getBlob', current.pds);
    url.search = new URLSearchParams({
      did: current.uri.split('/')[2],
      cid: 'ref' in blob ? blob.ref.$link : blob.cid,
    }).toString();
    return url.href;
  }
  const embed = current.value.embed;
  const raw =
    embed?.$type === 'app.bsky.embed.recordWithMedia' ? embed.media : embed;
  switch (raw?.$type) {
    case 'app.bsky.embed.images':
      return {
        $type: 'app.bsky.embed.images#view',
        images: raw.images.map((image) => ({
          fullsize: blobUrl(image.image),
          alt: image.alt,
        })),
      };
    case 'app.bsky.embed.gallery':
      return {
        $type: 'app.bsky.embed.gallery#view',
        items: raw.items.flatMap((item) =>
          item.$type === 'app.bsky.embed.gallery#image'
            ? [
                {
                  $type: 'app.bsky.embed.gallery#viewImage',
                  fullsize: blobUrl(item.image),
                  alt: item.alt,
                },
              ]
            : []
        ),
      };
    case 'app.bsky.embed.video':
      return {
        $type: 'app.bsky.embed.video#view',
        playlist: blobUrl(raw.video),
        alt: raw.alt,
      };
    case 'app.bsky.embed.external':
      return { $type: 'app.bsky.embed.external#view', external: raw.external };
    default:
      return undefined;
  }
}
export function quotesCopy(
  record: AppBskyFeedPost.Main,
  copyUri: string
): boolean {
  const embed = record.embed;
  return (
    (embed?.$type === 'app.bsky.embed.record' &&
      embed.record.uri === copyUri) ||
    (embed?.$type === 'app.bsky.embed.recordWithMedia' &&
      embed.record.record.uri === copyUri)
  );
}
