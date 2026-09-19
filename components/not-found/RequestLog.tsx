'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import SiteLink from '@/components/link/SiteLink';

import { isParkedPath } from '@/lib/site';

import { closestPath } from './closest';
import './not-found.css';

interface RequestLogProps {
  /** Every routed page path, for the closest-match line. */
  paths: string[];
}

/**
 * The failed request printed as a server log, one line at a time. The
 * last frame of the trace is the visitor: where they came from if the
 * browser says, or that they typed the address.
 */
export default function RequestLog({ paths }: RequestLogProps) {
  const pathname = usePathname() ?? '/';
  const [origin, setOrigin] = useState<string | null>(null);

  // document.referrer only exists in the browser, so the visitor's frame
  // is filled in after hydration and prints with the rest of the log.
  useEffect(() => {
    let from = 'typed it in';
    try {
      if (document.referrer) {
        const referrer = new URL(document.referrer);
        from =
          referrer.host === window.location.host
            ? `followed a link on ${referrer.pathname}`
            : `followed a link from ${referrer.host.replace(/^www\./, '')}`;
      }
    } catch {
      // A malformed referrer reads the same as none.
    }
    setOrigin(from);
  }, []);

  const parked = isParkedPath(pathname);
  const match = parked ? null : closestPath(pathname, paths);

  let line = 0;
  const next = () => ({ '--line': line++ }) as React.CSSProperties;

  return (
    <pre className="request-log">
      <span className="request-log__line" style={next()}>
        <span className="request-log__dim">GET</span> {pathname}
      </span>
      <span className="request-log__line" style={next()}>
        <span className="request-log__status">404</span> Not Found
      </span>
      <span className="request-log__gap" />
      <span
        className="request-log__line request-log__frame request-log__dim"
        style={next()}
      >
        at resolve (willie.page/app/router.ts:404)
      </span>
      <span
        className="request-log__line request-log__frame request-log__dim"
        style={next()}
        data-ready={origin !== null}
      >
        {origin ? `at you (${origin}, just now)` : ' '}
      </span>
      {(parked || match) && <span className="request-log__gap" />}
      {parked && (
        <span className="request-log__line" style={next()}>
          <span className="request-log__status">note</span> This page is being
          rebuilt. It will be back.
        </span>
      )}
      {match && (
        <span className="request-log__line" style={next()}>
          <span className="request-log__dim">Closest match:</span>{' '}
          <SiteLink href={match} className="request-log__link">
            {match}
          </SiteLink>
        </span>
      )}
      <span className="request-log__line" style={next()}>
        <span className="request-log__cursor" aria-hidden="true" />
      </span>
    </pre>
  );
}
