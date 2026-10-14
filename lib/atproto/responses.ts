import {
  blueskyPostUrl,
  blueskyProfileUrl,
  publicRecord,
} from '@/lib/atproto/bluesky';
import { documentUri } from '@/lib/atproto/keys';
import { assertOwnerCopy } from '@/lib/atproto/owner-copy';
import { pages, query } from '@/lib/atproto/responses/http';
import { emptyResponses } from '@/lib/atproto/responses/merge';
import {
  allowed,
  author,
  normalizeBlueskyPost,
  validProfile,
} from '@/lib/atproto/responses/normalize';
import {
  normalizeBlueskyReposts,
  refreshBlueskyCandidates,
} from '@/lib/atproto/responses/refresh';
import type { Post, Profile, Thread } from '@/lib/atproto/responses/types';
import type { ResponseGroup as WebmentionGroup } from '@/lib/indieweb/webmention/types';
import { absoluteUrl } from '@/lib/site/urls';
import type { WritingData } from '@/lib/writings/types';

export interface ResponseCandidate {
  post: Post;
  type: 'reply' | 'mention' | 'copy';
  parentUri?: string;
}
export async function loadBlueskyResponses(writing: WritingData): Promise<{
  groups: WebmentionGroup;
  copyUrl?: string;
  replyUrl?: string;
  incomplete?: boolean;
}> {
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
