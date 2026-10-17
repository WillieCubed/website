'use client';

import { type ReactNode } from 'react';

import BlueskyIcon from '@/components/icons/BlueskyIcon';
import Icon from '@/components/icons/Icon';
import WebmentionForm from '@/components/indieweb/WebmentionForm';
import SiteLink from '@/components/link/SiteLink';
import Popover from '@/components/site/Popover';

import styles from './PostActions.module.css';
import PostShareActions from './PostShareActions';
import { usePostReply } from './usePostReply';

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
  const { replyOpen, replyId, replySurface, replyTrigger, toggleReply } =
    usePostReply();

  return (
    <>
      <div className={styles.actions} role="group" aria-label="Writing actions">
        <div className={styles.recommendation}>{recommendation}</div>
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
            className={`site-control ${styles.action} ${styles.replyAction} ${styles.replyMain}`}
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
              className={`site-control ${styles.action} ${styles.replyAction} ${styles.replyDestination}`}
            >
              <BlueskyIcon className="size-4" />
              Reply on Bluesky
            </SiteLink>
          )}
          {blueskyReplyUrl && (
            <Popover
              label="Reply options"
              trigger={<Icon name="chevron-down" size={18} />}
              triggerClassName={`site-control ${styles.action} ${styles.replyAction} ${styles.splitArrow} ${styles.replyArrow}`}
              panelClassName={styles.menu}
              width={228}
            >
              <button
                type="button"
                className={`site-control ${styles.menuAction}`}
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
                className={`site-control ${styles.menuAction}`}
              >
                <BlueskyIcon className="size-4" />
                Reply on Bluesky
              </SiteLink>
            </Popover>
          )}
        </div>
        <PostShareActions
          target={target}
          title={title}
          blueskyHref={blueskyHref}
          threadsHref={threadsHref}
        />
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
            className={`site-control ${styles.action} ${styles.close}`}
            aria-label="Close IndieWeb reply"
            onClick={toggleReply}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <WebmentionForm target={target} />
      </div>
    </>
  );
}
