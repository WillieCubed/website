import { ComAtprotoRepoStrongRef } from '@atcute/atproto';
import { AppBskyFeedPost } from '@atcute/bluesky';
import type { Blob, LegacyBlob } from '@atcute/lexicons';
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
import {
  type CurrentResponseRecord,
  type ResponseRecordReader,
  createResponseRecordReader,
  parseCurrentResponsePost,
} from './response-records';

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
  cid?: string;
  author: Profile;
  record: {
    text?: string;
    createdAt?: string;
    reply?: { parent?: { uri?: string }; root?: { uri?: string } };
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

function currentMediaView(current: CurrentResponseRecord): Post['embed'] {
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

interface ResponseCandidate {
  post: Post;
  type: 'reply' | 'mention' | 'copy';
  parentUri?: string;
}

function quotesCopy(record: AppBskyFeedPost.Main, copyUri: string): boolean {
  const embed = record.embed;
  return (
    (embed?.$type === 'app.bsky.embed.record' &&
      embed.record.uri === copyUri) ||
    (embed?.$type === 'app.bsky.embed.recordWithMedia' &&
      embed.record.record.uri === copyUri)
  );
}

/** AppView decides visibility; the author's current record decides content. */
export async function refreshBlueskyCandidates(
  candidates: ResponseCandidate[],
  copyUri: string,
  target: string,
  hidden: Set<string>,
  options: { reader?: ResponseRecordReader; signal?: AbortSignal } = {}
): Promise<{ posts: Map<string, Post>; incomplete: boolean }> {
  const signal = options.signal ?? AbortSignal.timeout(20000);
  const reader = options.reader ?? createResponseRecordReader(signal);
  const posts = new Map<string, Post>();
  const visible = candidates.filter(
    ({ post, type }) =>
      normalizeBlueskyPost(
        post,
        target,
        type === 'copy' ? 'mention' : type,
        hidden
      ) && post.uri.split('/')[2] === post.author.did
  );
  let next = 0;
  let incomplete = false;
  const reads = new Map<string, Promise<CurrentResponseRecord | null>>();
  async function withinBudget<T>(pending: Promise<T>): Promise<T> {
    signal.throwIfAborted();
    let onAbort: () => void = () => {};
    try {
      return await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          onAbort = () => reject(signal.reason);
          signal.addEventListener('abort', onAbort, { once: true });
        }),
      ]);
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }
  async function worker() {
    while (next < visible.length && !signal.aborted) {
      const candidate = visible[next++];
      try {
        let pending = reads.get(candidate.post.uri);
        if (!pending) {
          pending = reader(candidate.post.uri);
          reads.set(candidate.post.uri, pending);
        }
        const current = await withinBudget(pending);
        if (!current || signal.aborted) continue;
        if (
          current.uri !== candidate.post.uri ||
          !safeParse(ComAtprotoRepoStrongRef.mainSchema, current).ok ||
          new URL(current.pds).protocol !== 'https:' ||
          new URL(current.pds).username ||
          new URL(current.pds).password
        )
          continue;
        const currentValue = parseCurrentResponsePost(
          current.value,
          current.legacyBlobCids
        ).value;
        if (candidate.type === 'reply') {
          if (
            currentValue.reply?.parent.uri !== candidate.parentUri ||
            currentValue.reply?.root.uri !== copyUri
          )
            continue;
        } else if (
          candidate.type === 'mention' &&
          !quotesCopy(currentValue, copyUri)
        )
          continue;
        const labels = currentValue.labels;
        if (
          labels?.$type === 'com.atproto.label.defs#selfLabels' &&
          !allowed({ labels: labels.values })
        )
          continue;
        const refreshed: Post = {
          ...candidate.post,
          cid: current.cid,
          record: currentValue,
          embed:
            current.cid === candidate.post.cid
              ? candidate.post.embed
              : currentMediaView({ ...current, value: currentValue }),
        };
        if (
          normalizeBlueskyPost(
            refreshed,
            target,
            candidate.type === 'copy' ? 'mention' : candidate.type,
            hidden
          )
        )
          posts.set(candidate.post.uri, refreshed);
      } catch {
        incomplete = true;
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  return {
    posts,
    incomplete: incomplete || signal.aborted || next < visible.length,
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

export async function loadBlueskyResponses(writing: WritingData): Promise<{
  groups: WebmentionGroup;
  copyUrl?: string;
  replyUrl?: string;
  incomplete?: boolean;
}> {
  'use cache';
  cacheLife('minutes');
  cacheTag('atproto-responses');
  return fetchBlueskyResponses(writing);
}

/** Uncached importer for fresh AppView reads and acceptance checks. */
export async function fetchBlueskyResponses(writing: WritingData): Promise<{
  groups: WebmentionGroup;
  copyUrl?: string;
  replyUrl?: string;
  incomplete?: boolean;
}> {
  const groups = emptyResponses();
  if (writing.draft) return { groups };
  let copyUrl: string | undefined;
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
    copyUrl = blueskyPostUrl(uri);
    const thread = await query<{
      thread: Thread;
      threadgate?: { record?: { hiddenReplies?: string[] } };
    }>('app.bsky.feed.getPostThread', {
      uri,
      depth: '100',
      parentHeight: '0',
    });
    if (
      !thread?.thread.post ||
      !allowed(thread.thread.post) ||
      !allowed(thread.thread.post.author)
    )
      return { groups, copyUrl };
    const [quotes, likes, reposts] = await Promise.all([
      pages<Post>('app.bsky.feed.getQuotes', uri, 'posts'),
      pages<{ actor: Profile; createdAt: string; indexedAt: string }>(
        'app.bsky.feed.getLikes',
        uri,
        'likes'
      ),
      pages<Profile>('app.bsky.feed.getRepostedBy', uri, 'repostedBy'),
    ]);
    const hidden = new Set(thread.threadgate?.record?.hiddenReplies ?? []);
    const candidates: ResponseCandidate[] = [
      { post: thread.thread.post, type: 'copy' },
    ];
    function discover(node: Thread, depth = 0) {
      for (const child of node.replies ?? []) {
        if (
          !child.post ||
          !normalizeBlueskyPost(child.post, target, 'reply', hidden) ||
          child.post.record.reply?.parent?.uri !== node.post?.uri
        )
          continue;
        candidates.push({
          post: child.post,
          type: 'reply',
          parentUri: node.post?.uri,
        });
        if (depth < 99) discover(child, depth + 1);
      }
    }
    discover(thread.thread);
    candidates.push(
      ...quotes.map((post) => ({ post, type: 'mention' as const }))
    );
    const current = await refreshBlueskyCandidates(
      candidates,
      uri,
      target,
      hidden
    );
    if (!current.posts.has(uri))
      return {
        groups,
        copyUrl,
        ...(current.incomplete && { incomplete: true }),
      };
    function replies(node: Thread, depth = 0) {
      for (const child of node.replies ?? []) {
        if (!child.post) continue;
        const refreshed = current.posts.get(child.post.uri);
        if (!refreshed) continue;
        const response = normalizeBlueskyPost(
          refreshed,
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
    groups.mentions = quotes.flatMap((post) => {
      const refreshed = current.posts.get(post.uri);
      return refreshed
        ? (normalizeBlueskyPost(refreshed, target, 'mention') ?? [])
        : [];
    });
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
    return {
      groups,
      copyUrl,
      replyUrl: copyUrl,
      ...(current.incomplete && { incomplete: true }),
    };
  } catch (error) {
    console.error('Could not refresh Bluesky responses:', error);
    return { groups, ...(copyUrl && { copyUrl }), incomplete: true };
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
