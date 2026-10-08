import { AppBskyFeedPost } from '@atcute/bluesky';
import { safeParse } from '@atcute/lexicons';
import { cacheLife, cacheTag } from 'next/cache';

import { documentUri } from '@/lib/atproto/keys';
import type {
  PublishingResponse,
  ResponseMedia,
  ResponseGroup as WebmentionGroup,
} from '@/lib/indieweb/types';
import { absoluteUrl } from '@/lib/site';
import type { WritingData } from '@/lib/writings/types';

import {
  assertOwnerCopy,
  blueskyHandlePostUrl,
  blueskyPostUrl,
  blueskyProfileUrl,
  publicRecord,
} from './bluesky';
import { blueskyAppview } from './config';
import { oauthFetch } from './oauth-fetch';
import {
  type ResponseObservationStore,
  responseObservationStore,
} from './response-observations';

interface Profile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  labels?: { val: string; neg?: boolean }[];
  viewer?: { blockedBy?: boolean; blocking?: string };
}
interface Post {
  uri: string;
  author: Profile;
  record: {
    text?: string;
    createdAt?: string;
    reply?: { parent?: { uri?: string } };
  };
  indexedAt: string;
  labels?: Profile['labels'];
  embed?: {
    $type: string;
    alt?: string;
    items?: { $type: string; fullsize?: string; alt?: string }[];
    images?: { fullsize: string; alt?: string }[];
    playlist?: string;
    thumbnail?: string;
    media?: Post['embed'];
    external?: { uri: string; title?: string; description?: string };
  };
}
interface Thread {
  post?: Post;
  replies?: Thread[];
  $type?: string;
}

export const emptyResponses = (): WebmentionGroup => ({
  likes: [],
  reposts: [],
  replies: [],
  mentions: [],
  bookmarks: [],
  rsvps: [],
});

function allowed(value: {
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
function validProfile(profile: Profile): boolean {
  return (
    !!profile &&
    typeof profile.did === 'string' &&
    /^did:[a-z]+:[^/]+$/.test(profile.did) &&
    typeof profile.handle === 'string' &&
    !!profile.handle
  );
}
function author(profile: Profile) {
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

export async function normalizeBlueskyReposts(
  profiles: Profile[],
  target: string,
  copyUri: string,
  options: { observations?: ResponseObservationStore | null; now?: Date } = {}
): Promise<PublishingResponse[]> {
  const visible = profiles.filter(
    (profile) => validProfile(profile) && allowed(profile)
  );
  const store =
    options.observations === undefined
      ? process.env.POSTGRES_URL
        ? responseObservationStore
        : null
      : options.observations;
  let receipts = new Map<string, Date>();
  if (store) {
    try {
      receipts = await store.observe(
        copyUri,
        visible.map((profile) => profile.did)
      );
    } catch {
      console.warn('Native repost observation storage is unavailable.');
    }
  }
  const now = options.now ?? new Date();
  return visible.map((profile) => {
    const receipt = receipts.get(profile.did);
    const observedAt =
      receipt && Number.isFinite(receipt.getTime()) ? receipt : undefined;
    return {
      id: `repost:${profile.did}:${copyUri}`,
      sourceUrl: blueskyProfileUrl(profile.did),
      targetUrl: target,
      type: 'repost',
      origin: 'atproto',
      sourceAliases: [blueskyProfileUrl(profile.handle)],
      author: author(profile),
      receivedAt: observedAt ?? now,
      ...(observedAt && { observedAt }),
    };
  });
}
async function query<T>(
  method: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(`/xrpc/${method}`, blueskyAppview());
  url.search = new URLSearchParams(params).toString();
  const response = await oauthFetch(url);
  if (!response.ok)
    throw new Error(`Bluesky responses unavailable (${response.status}).`);
  return response.json();
}
async function pages<T>(
  method: string,
  uri: string,
  property: string
): Promise<T[]> {
  const values: T[] = [];
  let cursor: string | undefined;
  // Bound remote work; a popular post must not exhaust a serverless invocation.
  for (let page = 0; page < 10; page++) {
    const result = await query<Record<string, unknown>>(method, {
      uri,
      limit: '100',
      ...(cursor && { cursor }),
    });
    if (!Array.isArray(result[property]))
      throw new Error('The AppView response has no result list.');
    values.push(...(result[property] as T[]));
    const next = result.cursor as string | undefined;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return values;
}

export async function loadBlueskyResponses(
  writing: WritingData
): Promise<{ groups: WebmentionGroup; copyUrl?: string }> {
  'use cache';
  cacheLife('minutes');
  cacheTag('atproto-responses');
  const groups = emptyResponses();
  if (writing.draft) return { groups };
  try {
    const document = documentUri(
      `/writings/${writing.slug}`,
      writing.published
    );
    if (!document) return { groups };
    const record = await publicRecord(document);
    const ref = record?.value.bskyPostRef;
    if (!ref) return { groups };
    assertOwnerCopy(ref);
    const uri = ref.uri;
    const target = absoluteUrl(`/writings/${writing.slug}`);
    const copyUrl = blueskyPostUrl(uri);
    const thread = await query<{
      thread: Thread;
      threadgate?: { record?: { hiddenReplies?: string[] } };
    }>('app.bsky.feed.getPostThread', {
      uri,
      depth: '100',
      parentHeight: '0',
    }).catch(() => null);
    if (
      !thread?.thread.post ||
      !allowed(thread.thread.post) ||
      !allowed(thread.thread.post.author)
    )
      return { groups, copyUrl };
    const [quotes, likes, reposts] = await Promise.all([
      pages<Post>('app.bsky.feed.getQuotes', uri, 'posts').catch(() => []),
      pages<{ actor: Profile; createdAt: string; indexedAt: string }>(
        'app.bsky.feed.getLikes',
        uri,
        'likes'
      ).catch(() => []),
      pages<Profile>('app.bsky.feed.getRepostedBy', uri, 'repostedBy').catch(
        () => []
      ),
    ]);
    const hidden = new Set(thread.threadgate?.record?.hiddenReplies ?? []);
    function replies(node: Thread, depth = 0) {
      for (const child of node.replies ?? []) {
        if (!child.post) continue;
        const response = normalizeBlueskyPost(
          child.post,
          target,
          'reply',
          hidden
        );
        if (
          !response ||
          child.post.record.reply?.parent?.uri !== node.post?.uri
        )
          continue;
        groups.replies.push({ ...response, threadDepth: depth });
        if (depth < 99) replies(child, depth + 1);
      }
    }
    if (
      thread.thread.post &&
      allowed(thread.thread.post) &&
      allowed(thread.thread.post.author)
    )
      replies(thread.thread);
    groups.mentions = quotes.flatMap(
      (post) => normalizeBlueskyPost(post, target, 'mention') ?? []
    );
    groups.likes = likes
      .filter(
        (like) =>
          like &&
          validProfile(like.actor) &&
          allowed(like.actor) &&
          Number.isFinite(Date.parse(like.createdAt)) &&
          Number.isFinite(Date.parse(like.indexedAt))
      )
      .map((like) => ({
        id: `like:${like.actor.did}:${uri}`,
        sourceUrl: blueskyProfileUrl(like.actor.did),
        targetUrl: target,
        type: 'like',
        origin: 'atproto',
        sourceAliases: [blueskyProfileUrl(like.actor.handle)],
        author: author(like.actor),
        publishedAt: new Date(like.createdAt),
        receivedAt: new Date(like.indexedAt),
      }));
    groups.reposts = await normalizeBlueskyReposts(reposts, target, uri);
    return { groups, copyUrl };
  } catch (error) {
    console.error('Could not refresh Bluesky responses:', error);
    return { groups };
  }
}

export function mergeResponses(
  indieweb: WebmentionGroup | null,
  atmosphere: WebmentionGroup
): WebmentionGroup {
  const output = emptyResponses();
  const aliases = new Map<string, string>();
  const canonical = (url: string) => {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      return parsed.href.replace(/\/$/, '');
    } catch {
      return url;
    }
  };
  for (const response of Object.values(atmosphere).flat()) {
    for (const url of [response.sourceUrl, ...(response.sourceAliases ?? [])])
      aliases.set(canonical(url), canonical(response.sourceUrl));
  }
  for (const key of Object.keys(output) as (keyof WebmentionGroup)[]) {
    const seen = new Set<string>();
    output[key] = [...(indieweb?.[key] ?? []), ...atmosphere[key]].filter(
      (response) => {
        const source = canonical(
          response.type === 'like' || response.type === 'repost'
            ? (response.author.url ?? response.sourceUrl)
            : response.sourceUrl
        );
        const identity = `${response.type}:${aliases.get(source) ?? source}`;
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      }
    );
  }
  return output;
}
