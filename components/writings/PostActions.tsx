'use client';

import { type ReactNode } from 'react';

import BlueskyIcon from '@/components/icons/BlueskyIcon';
import Icon from '@/components/icons/Icon';
import WebmentionForm from '@/components/indieweb/WebmentionForm';
import SiteLink from '@/components/link/SiteLink';
import Popover from '@/components/site/Popover';

import PostShareActions from './PostShareActions';
import './post-actions.css';
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
      <div
        className="post-actions-actions"
        role="group"
        aria-label="Writing actions"
      >
        <div className="post-actions-recommendation">{recommendation}</div>
        <div
          ref={replyTrigger}
          className="post-actions-reply"
          data-split={blueskyReplyUrl ? '' : undefined}
          role={blueskyReplyUrl ? 'group' : undefined}
          aria-label={blueskyReplyUrl ? 'Reply to this writing' : undefined}
        >
          <button
            type="button"
            data-post-action
            className="site-control post-actions-action post-actions-reply-action post-actions-reply-main"
            aria-label="Reply via IndieWeb"
            aria-expanded={replyOpen}
            aria-controls={replyId}
            onClick={toggleReply}
          >
            <Icon name="reply" size={16} />
            {blueskyReplyUrl ? (
              <>
                <span className="post-actions-reply-compact-label">Reply</span>
                <span className="post-actions-reply-expanded-label">
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
              className="site-control post-actions-action post-actions-reply-action post-actions-reply-destination"
            >
              <BlueskyIcon className="size-4" />
              Reply on Bluesky
            </SiteLink>
          )}
          {blueskyReplyUrl && (
            <Popover
              label="Reply options"
              trigger={<Icon name="chevron-down" size={18} />}
              triggerClassName="site-control post-actions-action post-actions-reply-action post-actions-split-arrow post-actions-reply-arrow"
              panelClassName="post-actions-menu"
              width={228}
            >
              <button
                type="button"
                className="site-control post-actions-menu-action"
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
                className="site-control post-actions-menu-action"
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
        className="post-actions-form"
      >
        <div className="post-actions-form-heading">
          <h2>Reply via IndieWeb</h2>
          <button
            type="button"
            className="site-control post-actions-action post-actions-close"
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
