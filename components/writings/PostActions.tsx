'use client';

import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import BlueskyIcon from '@/components/icons/BlueskyIcon';
import Icon from '@/components/icons/Icon';
import ThreadsIcon from '@/components/icons/ThreadsIcon';
import WebmentionForm from '@/components/indieweb/WebmentionForm';
import SiteLink from '@/components/link/SiteLink';

interface PostActionsProps {
  blueskyHref: string;
  target: string;
  threadsHref: string;
  title: string;
}

const secondaryAction =
  'inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-label-large font-medium text-ink no-underline transition-colors hover:border-accent hover:bg-tray';

export default function PostActions({
  blueskyHref,
  target,
  threadsHref,
  title,
}: PostActionsProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const replyId = useId();
  const replySurface = useRef<HTMLDivElement>(null);
  const transitioning = useRef(false);

  async function toggleReply() {
    if (transitioning.current) return;
    const opening = !replyOpen;
    const surface = replySurface.current;
    if (
      !document.startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !surface
    ) {
      setReplyOpen(opening);
      return;
    }

    transitioning.current = true;
    document.documentElement.dataset.postReplyTransition = '';
    surface.style.viewTransitionName = 'post-reply';
    try {
      const started = document.startViewTransition(() => {
        flushSync(() => setReplyOpen(opening));
      });
      // ready rejects alongside finished when the browser cancels, and
      // only finished is awaited here.
      started.ready.catch(() => undefined);
      await started.finished;
    } catch {
      // The browser can cancel a transition without cancelling its state update.
    } finally {
      surface.style.viewTransitionName = '';
      delete document.documentElement.dataset.postReplyTransition;
      transitioning.current = false;
    }
  }

  async function sharePost() {
    setShareStatus('');
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url: target });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setShareStatus('Sharing failed. Try again.');
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(target);
      setShareStatus('Post link copied.');
    } catch {
      setShareStatus('This browser cannot share or copy the post link.');
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        <div
          ref={replySurface}
          data-reply-surface
          className={
            replyOpen
              ? 'bleed w-[calc(100%+2*var(--bleed))] shrink-0 rounded-3xl bg-surface-container py-5'
              : 'rounded-full bg-primary text-on-primary'
          }
        >
          <button
            type="button"
            data-post-action
            aria-expanded={replyOpen}
            aria-controls={replyId}
            onClick={toggleReply}
            className={
              replyOpen
                ? 'flex w-full items-center gap-2 text-title-medium font-semibold text-ink'
                : 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-label-large font-semibold transition-colors hover:bg-primary/90'
            }
          >
            <Icon name="reply" size={16} />
            <span className="flex-1 text-left">Reply via IndieWeb</span>
            {replyOpen && (
              <Icon name="arrow-right" size={18} className="-rotate-90" />
            )}
          </button>
          <div id={replyId} hidden={!replyOpen} className="pt-4">
            <WebmentionForm target={target} />
          </div>
        </div>
        <SiteLink
          href={blueskyHref}
          target="_blank"
          data-post-action
          className={secondaryAction}
        >
          <BlueskyIcon className="size-4" />
          Share on Bluesky
        </SiteLink>
        <SiteLink
          href={threadsHref}
          target="_blank"
          data-post-action
          className={secondaryAction}
        >
          <ThreadsIcon className="size-4" />
          Share on Threads
        </SiteLink>
        <button
          type="button"
          data-post-action
          onClick={sharePost}
          className={secondaryAction}
        >
          <Icon name="share" size={16} />
          Share
        </button>
      </div>
      {shareStatus && (
        <p role="status" className="mt-2 text-label-medium text-muted">
          {shareStatus}
        </p>
      )}
    </>
  );
}
