'use client';

import Link, { type LinkProps } from 'next/link';
import { type AnchorHTMLAttributes, type PropsWithChildren } from 'react';

import { isInternalHref } from '@/lib/site/urls';

import LinkPreview from './LinkPreview';
import NavigationHint from './NavigationHint';
import './link.css';
import { schemeVars } from './scheme';
import { useLinkPreview } from './useLinkPreview';

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

export interface SiteLinkProps
  extends AnchorProps, Pick<LinkProps, 'prefetch' | 'scroll' | 'replace'> {
  href: string;
  /**
   * Show the hover card for in-site destinations. Turn it off on links that
   * already are a card (tiles, list items, navigation), where a second card
   * would only repeat what is under the pointer.
   */
  preview?: boolean;
}

/**
 * The one link component for the site. In-site links get client-side
 * navigation and a hover card fed by the entity registry; everything else
 * renders as a plain anchor.
 */
export default function SiteLink({
  href,
  preview = true,
  children,
  prefetch,
  scroll,
  replace,
  ...props
}: PropsWithChildren<SiteLinkProps>) {
  if (!isInternalHref(href)) {
    return (
      <a {...props} href={href} rel={props.rel ?? 'noopener'}>
        {children}
      </a>
    );
  }
  if (preview && !href.startsWith('#')) {
    return (
      <PreviewSiteLink
        {...props}
        href={href}
        prefetch={prefetch}
        scroll={scroll}
        replace={replace}
      >
        {children}
      </PreviewSiteLink>
    );
  }
  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      scroll={scroll}
      replace={replace}
    >
      {children}
      <NavigationHint />
    </Link>
  );
}

/** Only links that render a hover card mount its intent and popover lifetime. */
function PreviewSiteLink({
  href,
  children,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onPointerDown,
  prefetch,
  scroll,
  replace,
  ...rest
}: PropsWithChildren<SiteLinkProps>) {
  const {
    anchorRef,
    popoverRef,
    card,
    style,
    clearTimers,
    scheduleShow,
    scheduleHide,
    hide,
  } = useLinkPreview(href);

  const cardStyle = card?.brand
    ? { ...style, ...schemeVars(card.brand) }
    : style;

  return (
    <>
      <Link
        {...rest}
        ref={anchorRef}
        href={href}
        prefetch={prefetch}
        scroll={scroll}
        replace={replace}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          if (event.pointerType === 'mouse') scheduleShow();
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          scheduleHide();
        }}
        onFocus={(event) => {
          onFocus?.(event);
          if (event.currentTarget.matches(':focus-visible')) {
            scheduleShow();
          }
        }}
        onBlur={(event) => {
          onBlur?.(event);
          hide();
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          hide();
        }}
      >
        {children}
        <NavigationHint />
      </Link>
      {card && (
        <LinkPreview
          card={card}
          style={cardStyle}
          popoverRef={popoverRef}
          // WCAG 1.4.13: the pointer can move onto the card and rest there.
          onPointerEnter={clearTimers}
          onPointerLeave={scheduleHide}
        />
      )}
    </>
  );
}
