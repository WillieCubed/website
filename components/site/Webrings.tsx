'use client';

import { useEffect, useId, useRef } from 'react';

import Icon from '@/components/icons/Icon';
import UtdIcon from '@/components/icons/UtdIcon';
import SiteLink from '@/components/link/SiteLink';

const RINGS = [
  {
    name: 'IndieWeb Webring',
    neighbor: 'IndieWeb',
    directory: 'https://xn--sr8hvo.ws',
    previous: 'https://xn--sr8hvo.ws/previous',
    next: 'https://xn--sr8hvo.ws/next',
  },
  {
    name: 'UT Dallas ECS Webring',
    neighbor: 'UT Dallas',
    directory: 'https://ecs.utdring.com/#https://willie.page',
    previous: 'https://ecs.utdring.com/#https://willie.page?nav=prev',
    next: 'https://ecs.utdring.com/#https://willie.page?nav=next',
  },
];

/** Direct navigation on every input; names also appear on hover and focus. */
export default function Webrings() {
  const labelId = useId();
  const tooltipId = useId();
  const group = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = group.current;
    const popup = tooltip.current;
    if (!container || !popup || typeof popup.showPopover !== 'function') return;
    let active: HTMLAnchorElement | null = null;
    let focused: HTMLAnchorElement | null = null;
    let dismissed: HTMLAnchorElement | null = null;
    let suppressFocus = false;
    let intentTimer = 0;
    let closeTimer = 0;
    const hide = () => {
      window.clearTimeout(intentTimer);
      window.clearTimeout(closeTimer);
      active?.removeAttribute('aria-describedby');
      if (popup.matches(':popover-open')) popup.hidePopover();
      active = null;
    };
    const show = (link: HTMLAnchorElement) => {
      if (link.closest('[inert]')) return;
      hide();
      active = link;
      popup.textContent = link.dataset.webringLabel ?? '';
      popup.showPopover();
      const box = link.getBoundingClientRect();
      popup.style.left = `${Math.min(window.innerWidth - popup.offsetWidth - 12, Math.max(12, box.left + (box.width - popup.offsetWidth) / 2))}px`;
      const above = box.top - popup.offsetHeight - 8;
      popup.style.top = `${above >= 12 ? above : box.bottom + 8}px`;
      link.setAttribute('aria-describedby', popup.id);
    };
    const leave = () => {
      if (
        focused === document.activeElement &&
        focused !== dismissed &&
        focused
      )
        show(focused);
      else closeTimer = window.setTimeout(hide, 200);
    };
    const cleanups = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[data-webring-label]')
    ).map((link) => {
      const enter = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        window.clearTimeout(closeTimer);
        intentTimer = window.setTimeout(() => show(link), 250);
      };
      const exit = () => {
        window.clearTimeout(intentTimer);
        leave();
      };
      const focus = () => {
        if (!link.matches(':focus-visible') || suppressFocus) return;
        focused = link;
        dismissed = null;
        show(link);
      };
      const blur = () => {
        focused = null;
        dismissed = null;
        hide();
      };
      const press = () => {
        suppressFocus = false;
        hide();
      };
      link.addEventListener('pointerenter', enter);
      link.addEventListener('pointerleave', exit);
      link.addEventListener('focus', focus);
      link.addEventListener('blur', blur);
      link.addEventListener('pointerdown', press);
      return () => {
        link.removeEventListener('pointerenter', enter);
        link.removeEventListener('pointerleave', exit);
        link.removeEventListener('focus', focus);
        link.removeEventListener('blur', blur);
        link.removeEventListener('pointerdown', press);
      };
    });
    const retain = () => window.clearTimeout(closeTimer);
    const onKey = (event: KeyboardEvent) => {
      suppressFocus = event.key === 'Escape';
      if (suppressFocus) {
        dismissed = focused;
        hide();
      }
    };
    popup.addEventListener('pointerenter', retain);
    popup.addEventListener('pointerleave', leave);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('resize', hide);
    return () => {
      hide();
      cleanups.forEach((cleanup) => cleanup());
      popup.removeEventListener('pointerenter', retain);
      popup.removeEventListener('pointerleave', leave);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide);
      window.removeEventListener('resize', hide);
    };
  }, []);

  return (
    <div
      ref={group}
      className="site-webrings"
      role="group"
      aria-labelledby={labelId}
    >
      <p className="site-webrings__label" id={labelId}>
        Webrings
      </p>
      <div className="site-webrings__controls">
        {RINGS.map((ring, index) => (
          <nav className="site-webring" aria-label={ring.name} key={ring.name}>
            <SiteLink
              preview={false}
              className="site-webring__link site-webring__direction"
              href={ring.previous}
              aria-label={`Previous site in the ${ring.name}`}
              data-webring-label={`Previous ${ring.neighbor} site`}
            >
              <Icon name="arrow-left" size={18} />
            </SiteLink>
            <SiteLink
              preview={false}
              className="site-webring__link site-webring__mark"
              href={ring.directory}
              aria-label={ring.name}
              data-webring-label={ring.name}
            >
              {index === 0 ? <Icon name="compass" size={18} /> : <UtdIcon />}
            </SiteLink>
            <SiteLink
              preview={false}
              className="site-webring__link site-webring__direction"
              href={ring.next}
              aria-label={`Next site in the ${ring.name}`}
              data-webring-label={`Next ${ring.neighbor} site`}
            >
              <Icon name="arrow-right" size={18} />
            </SiteLink>
          </nav>
        ))}
      </div>
      <div
        ref={tooltip}
        id={tooltipId}
        className="webring-tooltip"
        role="tooltip"
        popover="manual"
      />
    </div>
  );
}
