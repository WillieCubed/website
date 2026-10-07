'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import BlueskyIcon from '@/components/icons/BlueskyIcon';
import Icon from '@/components/icons/Icon';
import ThreadsIcon from '@/components/icons/ThreadsIcon';
import WebmentionForm from '@/components/indieweb/WebmentionForm';
import SiteLink from '@/components/link/SiteLink';
import Popover from '@/components/site/Popover';

import styles from './WritingActions.module.css';

interface PostActionsProps {
  blueskyHref: string;
  target: string;
  threadsHref: string;
  title: string;
  children?: ReactNode;
}

export default function PostActions({
  blueskyHref,
  target,
  threadsHref,
  title,
  children,
}: PostActionsProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [nativeSharing, setNativeSharing] = useState(false);

  useEffect(() => {
    setNativeSharing(typeof navigator.share === 'function');
  }, []);
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
      <div className={styles.toolbar}>
        {children}
        <button
          type="button"
          data-post-action
          aria-label="Reply via IndieWeb"
          aria-expanded={replyOpen}
          aria-controls={replyId}
          onClick={toggleReply}
          className={styles.action}
        >
          <Icon name="reply" size={17} />
          Reply
        </button>
        <Popover
          label="Share"
          trigger={
            <>
              <Icon name="share" size={17} />
              <span>Share</span>
            </>
          }
          triggerClassName={styles.action}
          panelClassName={styles.menu}
          align="end"
        >
          <SiteLink
            href={blueskyHref}
            target="_blank"
            className={styles.menuAction}
          >
            <span className={styles.menuItem}>
              <BlueskyIcon className="size-4" />
              Share on Bluesky
            </span>
            <Icon name="external" size={14} />
          </SiteLink>
          <SiteLink
            href={threadsHref}
            target="_blank"
            className={styles.menuAction}
          >
            <span className={styles.menuItem}>
              <ThreadsIcon className="size-4" />
              Share on Threads
            </span>
            <Icon name="external" size={14} />
          </SiteLink>
          <button
            type="button"
            className={styles.menuAction}
            onClick={(event) => {
              event.currentTarget
                .closest<HTMLElement>('[popover]')
                ?.hidePopover();
              void sharePost();
            }}
          >
            <span className={styles.menuItem}>
              <Icon name={nativeSharing ? 'share' : 'copy'} />
              {nativeSharing ? 'More options' : 'Copy link'}
            </span>
          </button>
        </Popover>
      </div>
      <div
        ref={replySurface}
        data-reply-surface
        id={replyId}
        hidden={!replyOpen}
        className="bleed mt-3 rounded-3xl bg-surface-container py-5"
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
