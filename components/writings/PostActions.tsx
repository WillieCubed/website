'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import BlueskyIcon from '@/components/icons/BlueskyIcon';
import Icon from '@/components/icons/Icon';
import ThreadsIcon from '@/components/icons/ThreadsIcon';
import WebmentionForm from '@/components/indieweb/WebmentionForm';
import SiteLink from '@/components/link/SiteLink';
import Popover from '@/components/site/Popover';

import styles from './PostActions.module.css';

interface PostActionsProps {
  blueskyHref: string;
  blueskyReplyUrl?: string;
  recommendation?: ReactNode;
  target: string;
  threadsHref: string;
  title: string;
}

export default function PostActions({
  blueskyHref,
  blueskyReplyUrl,
  recommendation,
  target,
  threadsHref,
  title,
}: PostActionsProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const replyId = useId();
  const replySurface = useRef<HTMLDivElement>(null);
  const replyTrigger = useRef<HTMLDivElement>(null);
  const transitioning = useRef(false);

  useEffect(() => {
    const expanded = window.matchMedia('(min-width: 600px)');
    function showExpandedDestinations() {
      const menu =
        replyTrigger.current?.querySelector<HTMLElement>('[popover]');
      if (!expanded.matches || !menu?.matches(':popover-open')) return;
      const restoreFocus = menu.contains(document.activeElement);
      menu.hidePopover();
      if (restoreFocus) replyTrigger.current?.querySelector('button')?.focus();
    }
    expanded.addEventListener('change', showExpandedDestinations);
    return () =>
      expanded.removeEventListener('change', showExpandedDestinations);
  }, []);

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
      requestAnimationFrame(() =>
        (opening
          ? surface?.querySelector('input')
          : replyTrigger.current?.querySelector('button')
        )?.focus()
      );
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
      (opening
        ? surface.querySelector('input')
        : replyTrigger.current?.querySelector('button')
      )?.focus();
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
      <div className={styles.actions} role="group" aria-label="Writing actions">
        <div
          ref={replyTrigger}
          className={styles.reply}
          data-split={blueskyReplyUrl ? '' : undefined}
          role={blueskyReplyUrl ? 'group' : undefined}
          aria-label={blueskyReplyUrl ? 'Reply to this writing' : undefined}
        >
          <button
            type="button"
            data-post-action
            className={`${styles.action} ${styles.replyAction} ${styles.replyMain}`}
            aria-label="Reply via IndieWeb"
            aria-expanded={replyOpen}
            aria-controls={replyId}
            onClick={toggleReply}
          >
            <Icon name="reply" size={16} />
            {blueskyReplyUrl ? (
              <>
                <span className={styles.replyCompactLabel}>Reply</span>
                <span className={styles.replyExpandedLabel}>
                  Reply via IndieWeb
                </span>
              </>
            ) : (
              'Reply via IndieWeb'
            )}
          </button>
          {blueskyReplyUrl && (
            <SiteLink
              href={blueskyReplyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.action} ${styles.replyAction} ${styles.replyDestination}`}
            >
              <BlueskyIcon className="size-4" />
              Reply on Bluesky
            </SiteLink>
          )}
          {blueskyReplyUrl && (
            <Popover
              label="Reply options"
              trigger={<Icon name="chevron-down" size={18} />}
              triggerClassName={`${styles.action} ${styles.replyAction} ${styles.splitArrow} ${styles.replyArrow}`}
              panelClassName={styles.menu}
              width={228}
            >
              <button
                type="button"
                className={styles.menuAction}
                aria-controls={replyId}
                aria-expanded={replyOpen}
                onClick={(event) => {
                  event.currentTarget
                    .closest<HTMLElement>('[popover]')
                    ?.hidePopover();
                  if (!replyOpen) void toggleReply();
                  else replySurface.current?.querySelector('input')?.focus();
                }}
              >
                <Icon name="reply" size={18} />
                Reply via IndieWeb
              </button>
              <SiteLink
                href={blueskyReplyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.menuAction}
              >
                <BlueskyIcon className="size-4" />
                Reply on Bluesky
              </SiteLink>
            </Popover>
          )}
        </div>
        <div className={styles.recommendation}>{recommendation}</div>
        <div
          className={styles.share}
          role="group"
          aria-label="Share this writing"
        >
          <button
            type="button"
            data-post-action
            onClick={sharePost}
            className={`${styles.action} ${styles.splitMain} ${styles.shareMain}`}
            aria-label={shareStatus || 'Share this writing'}
            title={shareStatus || 'Share this writing'}
          >
            <Icon
              name={shareStatus === 'Post link copied.' ? 'check' : 'share'}
              size={16}
            />
            <span className={styles.shareLabel}>Share</span>
          </button>
          <Popover
            label="More sharing options"
            trigger={<Icon name="chevron-down" size={18} />}
            triggerClassName={`${styles.action} ${styles.splitArrow}`}
            panelClassName={styles.menu}
            align="end"
            width={228}
          >
            <SiteLink
              href={blueskyHref}
              target="_blank"
              className={styles.menuAction}
            >
              <BlueskyIcon className="size-4" />
              Share on Bluesky
            </SiteLink>
            <SiteLink
              href={threadsHref}
              target="_blank"
              className={styles.menuAction}
            >
              <ThreadsIcon className="size-4" />
              Share on Threads
            </SiteLink>
          </Popover>
        </div>
      </div>
      <div
        ref={replySurface}
        data-reply-surface
        id={replyId}
        hidden={!replyOpen}
        className={styles.form}
      >
        <div className={styles.formHeading}>
          <h2>Reply via IndieWeb</h2>
          <button
            type="button"
            className={`${styles.action} ${styles.close}`}
            aria-label="Close IndieWeb reply"
            onClick={toggleReply}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <WebmentionForm target={target} />
      </div>
      <span role="status" className="sr-only">
        {shareStatus}
      </span>
    </>
  );
}
