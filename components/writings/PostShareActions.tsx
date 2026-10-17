import { useState } from 'react';

import BlueskyIcon from '@/components/icons/BlueskyIcon';
import Icon from '@/components/icons/Icon';
import ThreadsIcon from '@/components/icons/ThreadsIcon';
import SiteLink from '@/components/link/SiteLink';
import Popover from '@/components/site/Popover';

import './post-actions.css';

interface PostShareActionsProps {
  target: string;
  title: string;
  blueskyHref: string;
  threadsHref: string;
}

/** Native sharing and clipboard feedback belong to the sharing controls. */
export default function PostShareActions({
  target,
  title,
  blueskyHref,
  threadsHref,
}: PostShareActionsProps) {
  const [shareStatus, setShareStatus] = useState('');
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
      <div
        className="post-actions-share"
        role="group"
        aria-label="Share this writing"
      >
        <button
          type="button"
          data-post-action
          onClick={sharePost}
          className="site-control post-actions-action post-actions-split-main post-actions-share-main"
          aria-label={shareStatus || 'Share this writing'}
          title={shareStatus || 'Share this writing'}
        >
          <Icon
            name={shareStatus === 'Post link copied.' ? 'check' : 'share'}
            size={16}
          />
          <span className="post-actions-share-label">Share</span>
        </button>
        <Popover
          label="More sharing options"
          trigger={<Icon name="chevron-down" size={18} />}
          triggerClassName="site-control post-actions-action post-actions-split-arrow"
          panelClassName="post-actions-menu"
          align="end"
          width={228}
        >
          <SiteLink
            href={blueskyHref}
            target="_blank"
            className="site-control post-actions-menu-action"
          >
            <BlueskyIcon className="size-4" />
            Share on Bluesky
          </SiteLink>
          <SiteLink
            href={threadsHref}
            target="_blank"
            className="site-control post-actions-menu-action"
          >
            <ThreadsIcon className="size-4" />
            Share on Threads
          </SiteLink>
        </Popover>
      </div>
      <span role="status" className="sr-only">
        {shareStatus}
      </span>
    </>
  );
}
