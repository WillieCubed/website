'use client';

import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import Icon from '@/components/icons/Icon';
import ThreadsIcon from '@/components/icons/ThreadsIcon';
import WebmentionForm from '@/components/indieweb/WebmentionForm';
import SiteLink from '@/components/link/SiteLink';

interface PostActionsProps {
  target: string;
  threadsHref: string;
  title: string;
}

const secondaryAction =
  'inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-label-large font-medium text-ink no-underline transition-colors hover:border-accent hover:bg-tray';

export default function PostActions({
  target,
  threadsHref,
  title,
}: PostActionsProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const replyId = useId();
  const replyButton = useRef<HTMLButtonElement>(null);
  const replyPanel = useRef<HTMLDivElement>(null);
  const transitioning = useRef(false);

  async function toggleReply() {
    if (transitioning.current) return;
    const opening = !replyOpen;
    const source = opening ? replyButton.current : replyPanel.current;
    const destination = opening ? replyPanel.current : replyButton.current;
    if (
      !document.startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !source ||
      !destination
    ) {
      setReplyOpen(opening);
      return;
    }

    transitioning.current = true;
    document.documentElement.dataset.postReplyTransition = '';
    source.style.viewTransitionName = 'post-reply';
    try {
      await document.startViewTransition(() => {
        source.style.viewTransitionName = '';
        flushSync(() => setReplyOpen(opening));
        destination.style.viewTransitionName = 'post-reply';
      }).finished;
    } catch {
      // The browser can cancel a transition without cancelling its state update.
    } finally {
      source.style.viewTransitionName = '';
      destination.style.viewTransitionName = '';
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
      <div className="flex flex-wrap gap-2">
        <button
          ref={replyButton}
          type="button"
          data-post-action
          aria-expanded={replyOpen}
          aria-controls={replyId}
          onClick={toggleReply}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-label-large font-semibold text-on-primary transition-colors hover:bg-primary/90"
        >
          <Icon name="reply" size={16} />
          Reply via IndieWeb
        </button>
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
      <div
        ref={replyPanel}
        id={replyId}
        hidden={!replyOpen}
        className="bleed mt-4 rounded-3xl bg-surface-container py-5"
      >
        <WebmentionForm target={target} />
      </div>
      {shareStatus && (
        <p role="status" className="mt-2 text-label-medium text-muted">
          {shareStatus}
        </p>
      )}
    </>
  );
}
