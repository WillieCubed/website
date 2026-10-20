'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';

import {
  getPageColumn,
  getPageColumnOnServer,
  subscribeTopBar,
} from '@/lib/site/footer/column';
import {
  getFooterDocked,
  getFooterDockedOnServer,
  subscribeFooterDocked,
} from '@/lib/site/footer/docked';

import { startFooterDock } from './footer-dock-controller';
import './footer-dock.css';

function revealProfile(event: React.FocusEvent<HTMLElement>) {
  const link = event.target.closest<HTMLElement>('.site-footer__profiles a');
  if (!link) return;
  const strip = link.closest<HTMLElement>('.site-footer__profiles')!;
  const target = link.getBoundingClientRect();
  const viewport = strip.getBoundingClientRect();
  if (target.left < viewport.left) {
    strip.scrollLeft += target.left - viewport.left;
  } else if (target.right > viewport.right) {
    strip.scrollLeft += target.right - viewport.right;
  }
}

/**
 * The footer element itself. On most pages it is a plain block. On the
 * homepage, which enables the dock controller, it is the rail's contact
 * row until the page ends and then opens into the full footer: this marks
 * it for the stylesheet to draw and writes how far open it is as --p,
 * which the stylesheet derives everything else from. It also runs the
 * name's letter wave. On every page it carries the column the top bar
 * registered, so its text lines up with the page's.
 *
 * Both the mark and the opening are client-side, so a visitor without
 * scripting gets the plain footer rather than one stuck shut.
 */
export default function FooterFrame({ children }: React.PropsWithChildren) {
  const ref = useRef<HTMLElement>(null);
  const docked = useSyncExternalStore(
    subscribeFooterDocked,
    getFooterDocked,
    getFooterDockedOnServer
  );
  const column = useSyncExternalStore(
    subscribeTopBar,
    getPageColumn,
    getPageColumnOnServer
  );

  useEffect(() => {
    const footer = ref.current;
    if (!docked || !footer) return;
    // Keep the server layout when the visitor has reached its footer.
    // Normal visits still get the complete scroll-driven dock.
    if (footer.getBoundingClientRect().top < window.innerHeight) return;
    return startFooterDock(footer);
  }, [docked]);

  return (
    <footer
      ref={ref}
      className="site-footer"
      data-column={column ?? undefined}
      onFocusCapture={revealProfile}
    >
      {children}
    </footer>
  );
}
