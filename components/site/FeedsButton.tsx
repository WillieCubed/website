'use client';

import { useEffect, useId, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';

import { absoluteUrl } from '@/lib/site';

import './site.css';

interface FeedsButtonProps {
  /** Path the feeds hang off: '' for the whole site, '/writings' for posts. */
  base?: string;
}

/**
 * One button that opens the list of feeds for this page. RSS and Atom are
 * what a reader app wants; the JSON one is there for the few who ask.
 */
export default function FeedsButton({ base = '' }: FeedsButtonProps) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [open, setOpen] = useState(false);

  const feeds = [
    { label: 'RSS', href: `${base}/feed.xml`, quiet: false },
    { label: 'Atom', href: `${base}/feed/atom`, quiet: false },
    { label: 'JSON Feed', href: `${base}/feed/json`, quiet: true },
  ];

  // The popover lives in the top layer, so it is placed by hand next to
  // the button: above it when there is room, below it otherwise.
  function place() {
    const anchor = button.current?.getBoundingClientRect();
    const panel = popover.current;
    if (!anchor || !panel) return;
    const gap = 8;
    const left = Math.min(
      Math.max(16, anchor.left),
      window.innerWidth - panel.offsetWidth - 16
    );
    const above = anchor.top - panel.offsetHeight - gap;
    const top = above >= 16 ? above : anchor.bottom + gap;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  // The popover is fixed in the top layer, so it follows the button by hand
  // while it is open; scrolling or resizing would otherwise leave it behind.
  const follow = useRef(() => place());
  useEffect(() => {
    const listener = follow.current;
    return () => {
      window.removeEventListener('scroll', listener);
      window.removeEventListener('resize', listener);
    };
  }, []);

  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        className="feeds-button"
        aria-expanded={open}
        aria-controls={id}
      >
        <Icon name="rss" size={16} />
        Feeds
      </button>
      <div
        ref={popover}
        id={id}
        popover="auto"
        className="site-popover feeds-popover"
        onToggle={(event) => {
          if (event.newState === 'open') {
            setOpen(true);
            place();
            popover.current?.querySelector<HTMLElement>('a')?.focus();
            window.addEventListener('scroll', follow.current, {
              passive: true,
            });
            window.addEventListener('resize', follow.current);
          } else {
            setOpen(false);
            if (popover.current?.contains(document.activeElement)) {
              button.current?.focus();
            }
            window.removeEventListener('scroll', follow.current);
            window.removeEventListener('resize', follow.current);
            setCopied(null);
            setCopyMessage('');
          }
        }}
      >
        <ul>
          {feeds.map((feed) => (
            <li
              key={feed.href}
              className={feed.quiet ? 'feeds-popover__quiet' : undefined}
            >
              <a href={feed.href} className="feeds-popover__link">
                <span>{feed.label}</span>
                <span className="feeds-popover__url">
                  {absoluteUrl(feed.href)}
                </span>
              </a>
              <button
                type="button"
                className="feeds-popover__copy"
                aria-label={`Copy the ${feed.label} link`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(absoluteUrl(feed.href));
                    setCopied(feed.href);
                    setCopyMessage(`${feed.label} link copied.`);
                  } catch {
                    setCopied(null);
                    setCopyMessage(`Could not copy the ${feed.label} link.`);
                  }
                }}
              >
                <Icon
                  name={copied === feed.href ? 'check' : 'copy'}
                  size={14}
                />
              </button>
            </li>
          ))}
        </ul>
        <p className="sr-only" role="status">
          {copyMessage}
        </p>
      </div>
    </>
  );
}
