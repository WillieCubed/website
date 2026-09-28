import { extractWritingSlugFromTarget } from '@/lib/indieweb/activity-feed';
import { sendWebmention } from '@/lib/indieweb/send-webmention';
import type { Webmention, WebmentionSourceWriting } from '@/lib/indieweb/types';
import {
  getWebmention,
  salmentionStore,
} from '@/lib/indieweb/webmention-storage';
import { sitePath } from '@/lib/indieweb/webmention-targets';
import { absoluteUrl } from '@/lib/site';
import { loadWriting } from '@/lib/writings';

/**
 * Salmention (https://indieweb.org/Salmention): when a post that answers
 * another post gets a reply of its own, it tells the post it answered, so
 * that post can show the conversation continuing downstream. The resend is
 * an ordinary webmention from the post to its upstream targets; the
 * receiver fetches the post again and finds the new reply nested in it.
 */

/**
 * How long after one salmention a post waits before it may send another. A
 * busy thread would otherwise send upstream once per reply. A reply that
 * lands inside the window reaches upstream with the next salmention after it.
 */
export const SALMENTION_WINDOW_MS = 10 * 60 * 1000;

/** How often, and how far apart, the post is checked for the new reply. */
export interface SalmentionTiming {
  attempts: number;
  delayMs: number;
}

/**
 * The route sends right after revalidating the post, so the first look
 * usually finds the reply; the later ones cover a slow render.
 */
export const ROUTE_SALMENTION_TIMING: SalmentionTiming = {
  attempts: 3,
  delayMs: 10_000,
};

/**
 * The moderation script cannot revalidate the post, so it waits out the
 * minute its webmentions stay cached, and a stale render after that.
 */
export const SCRIPT_SALMENTION_TIMING: SalmentionTiming = {
  attempts: 13,
  delayMs: 15_000,
};

const PAGE_TIMEOUT_MS = 10_000;

export interface SalmentionDeps {
  /** The webmention that was just approved. */
  findWebmention: (id: string) => Promise<Webmention | null>;
  /** A published writing by slug, or null for a draft or a missing one. */
  loadWriting: (slug: string) => Promise<WebmentionSourceWriting | null>;
  /**
   * Claim the post's send window. Resolves false when the post sent a
   * salmention within `windowMs`, so two approvals never both send.
   */
  claim: (slug: string, windowMs: number) => Promise<boolean>;
  /** Whether the live post page shows a reply from `sourceUrl` yet. */
  pageShows: (pageUrl: string, sourceUrl: string) => Promise<boolean>;
  send: (
    sourceUrl: string,
    targetUrl: string
  ) => Promise<{ targetUrl: string; success: boolean; error?: string }>;
  sleep?: (ms: number) => Promise<void>;
}

export type SalmentionOutcome =
  | 'sent'
  /** Only a reply starts a salmention. */
  | 'not-a-reply'
  /** The mention is gone, or its target is not a published writing. */
  | 'not-found'
  /** The post answers nothing off this site. */
  | 'no-upstream'
  /** The post sent one within the window. */
  | 'rate-limited'
  /** The live post never showed the reply, so upstream would find nothing. */
  | 'not-shown';

export interface SalmentionResult {
  outcome: SalmentionOutcome;
  results: { targetUrl: string; success: boolean; error?: string }[];
}

/**
 * The posts a writing answers, which a salmention notifies. Its own pages
 * are left out, and so is the reply's source: a reply from the post this
 * one answered must not be sent straight back to it, which is the loop a
 * pair of sites running Salmention would otherwise fall into.
 */
export function upstreamTargets(
  writing: WebmentionSourceWriting,
  replySource: string
): string[] {
  const reply = normalized(replySource);
  const targets = [
    writing.inReplyTo,
    writing.likeOf,
    writing.repostOf,
    writing.bookmarkOf,
    writing.rsvp?.eventUrl,
  ].filter(
    (url): url is string =>
      Boolean(url) &&
      sitePath(url as string) === null &&
      normalized(url as string) !== reply
  );
  return [...new Set(targets)];
}

function normalized(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

/**
 * Resend a post's webmentions upstream after one of its replies is
 * approved. Only an approval starts this, never a re-verification, so an
 * upstream site that pings the post again cannot start another round.
 * Nothing is sent until the live post shows the reply, since the upstream
 * receiver reads the post, not this request.
 */
export async function sendSalmention(
  id: string,
  deps: SalmentionDeps,
  { attempts, delayMs }: SalmentionTiming = ROUTE_SALMENTION_TIMING
): Promise<SalmentionResult> {
  const none = (outcome: SalmentionOutcome): SalmentionResult => ({
    outcome,
    results: [],
  });
  const reply = await deps.findWebmention(id);
  if (!reply) return none('not-found');
  if (reply.type !== 'reply') return none('not-a-reply');
  const slug = extractWritingSlugFromTarget(reply.targetUrl);
  const writing = slug ? await deps.loadWriting(slug) : null;
  if (!slug || !writing) return none('not-found');

  const targets = upstreamTargets(writing, reply.sourceUrl);
  if (targets.length === 0) return none('no-upstream');

  const postUrl = absoluteUrl(`/writings/${slug}`);
  const sleep =
    deps.sleep ??
    ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  let shown = false;
  for (let attempt = 0; attempt < attempts && !shown; attempt++) {
    if (attempt > 0) await sleep(delayMs);
    shown = await deps.pageShows(postUrl, reply.sourceUrl);
  }
  if (!shown) return none('not-shown');
  // Claimed only once the reply shows, so a page that never refreshed does
  // not use up the window for the next reply.
  if (!(await deps.claim(slug, SALMENTION_WINDOW_MS))) {
    return none('rate-limited');
  }

  const results = [];
  for (const target of targets) {
    results.push(await deps.send(postUrl, target));
  }
  return { outcome: 'sent', results };
}

/**
 * Whether a page's HTML contains a reply's address, as the `u-url` of its
 * comment. React escapes `&` in attributes, so both spellings count.
 */
export function htmlShowsSource(html: string, sourceUrl: string): boolean {
  return (
    html.includes(sourceUrl) || html.includes(sourceUrl.replace(/&/g, '&amp;'))
  );
}

/**
 * The real storage, writings, network, and live site. The post page is this
 * site's own, so it is fetched directly rather than through the public-only
 * guard that strangers' addresses need.
 */
export function defaultSalmentionDeps(): SalmentionDeps {
  return {
    findWebmention: getWebmention,
    async loadWriting(slug) {
      try {
        const { writing } = await loadWriting(slug);
        return writing.draft ? null : writing;
      } catch {
        return null;
      }
    },
    claim: salmentionStore.claim,
    async pageShows(pageUrl, sourceUrl) {
      try {
        const response = await fetch(pageUrl, {
          cache: 'no-store',
          headers: { Accept: 'text/html' },
          signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        });
        return response.ok && htmlShowsSource(await response.text(), sourceUrl);
      } catch {
        return false;
      }
    },
    send: sendWebmention,
  };
}
