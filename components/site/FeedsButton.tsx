'use client';

import { useId, useRef, useState } from 'react';

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

  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        className="feeds-button"
      >
        <Icon name="rss" size={16} />
        Feeds
      </button>
      <div
        ref={popover}
        id={id}
        popover="auto"
        className="feeds-popover"
        onToggle={(event) => {
          if (event.newState === 'open') place();
          else setCopied(null);
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
                  } catch {
                    setCopied(null);
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
      </div>
    </>
  );
}
