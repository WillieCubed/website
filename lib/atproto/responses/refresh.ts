import { ComAtprotoRepoStrongRef } from '@atcute/atproto';
import { safeParse } from '@atcute/lexicons';

import { blueskyProfileUrl } from '@/lib/atproto/bluesky';
import {
  type CurrentResponseRecord,
  type ResponseRecordReader,
  createResponseRecordReader,
  parseCurrentResponsePost,
} from '@/lib/atproto/response-records';
import {
  allowed,
  author,
  currentMediaView,
  normalizeBlueskyPost,
  quotesCopy,
  validProfile,
} from '@/lib/atproto/responses/normalize';
import {
  type ResponseObservationStore,
  responseObservationStore,
} from '@/lib/atproto/responses/observations';
import type {
  Post,
  Profile,
  RefreshedBlueskyCandidates,
  ResponseCandidate,
} from '@/lib/atproto/responses/types';
import { hasDatabase } from '@/lib/db/postgres';
import type { PublishingResponse } from '@/lib/indieweb/webmention/types';

function validCurrentRecord(
  current: CurrentResponseRecord,
  expectedUri: string
): boolean {
  if (
    current.uri !== expectedUri ||
    !safeParse(ComAtprotoRepoStrongRef.mainSchema, current).ok
  )
    return false;
  const pds = new URL(current.pds);
  return pds.protocol === 'https:' && !pds.username && !pds.password;
}

function matchesCandidate(
  candidate: ResponseCandidate,
  value: CurrentResponseRecord['value'],
  copyUri: string
): boolean {
  if (candidate.type === 'reply')
    return (
      value.reply?.parent.uri === candidate.parentUri &&
      value.reply?.root.uri === copyUri
    );
  return candidate.type !== 'mention' || quotesCopy(value, copyUri);
}

function refreshCandidate(
  candidate: ResponseCandidate,
  current: CurrentResponseRecord,
  copyUri: string
): Post | null {
  if (!validCurrentRecord(current, candidate.post.uri)) return null;
  const value = parseCurrentResponsePost(
    current.value,
    current.legacyBlobCids
  ).value;
  if (!matchesCandidate(candidate, value, copyUri)) return null;
  if (
    value.labels?.$type === 'com.atproto.label.defs#selfLabels' &&
    !allowed({ labels: value.labels.values })
  )
    return null;
  return {
    ...candidate.post,
    cid: current.cid,
    record: value,
    embed:
      current.cid === candidate.post.cid
        ? candidate.post.embed
        : currentMediaView({ ...current, value }),
  };
}

export interface ResponseRefreshOptions {
  reader?: ResponseRecordReader;
  signal?: AbortSignal;
}

export interface RepostObservationOptions {
  observations?: ResponseObservationStore | null;
  now?: Date;
}

/** AppView decides visibility; the author's current record decides content. */
export async function refreshBlueskyCandidates(
  candidates: ResponseCandidate[],
  copyUri: string,
  target: string,
  hidden: Set<string>,
  options: ResponseRefreshOptions = {}
): Promise<RefreshedBlueskyCandidates> {
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
        const refreshed = refreshCandidate(candidate, current, copyUri);
        if (!refreshed) continue;
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
  options: RepostObservationOptions = {}
): Promise<PublishingResponse[]> {
  const visible = profiles.filter(
    (profile) => validProfile(profile) && allowed(profile)
  );
  const store =
    options.observations === undefined
      ? hasDatabase()
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
