'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import Mark from '@/components/brand/Mark';
import SiteLink from '@/components/link/SiteLink';

import {
  getTopBar,
  getTopBarOnServer,
  subscribeTopBar,
} from '@/lib/footer/column';

/**
 * The cube, with the name beside it. The name shows once per screen: on
 * most pages it wipes in once the top bar has left the screen, a trigger
 * rather than a scroll distance, so it never stops partway on a page that
 * can only scroll a little. On the homepage the footer's letter wave
 * brings it in instead (lib/footer/name-reveal.ts), and footer-dock.css
 * turns the wipe off there.
 */
export default function FooterLockup({ name }: { name: string }) {
  const menuId = useId();
  const markButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const firstMenuItem = useRef<HTMLAnchorElement>(null);
  const header = useSyncExternalStore(
    subscribeTopBar,
    getTopBar,
    getTopBarOnServer
  );
  const [revealed, setRevealed] = useState(false);
  const [colorPinned, setColorPinned] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoScheme, setLogoScheme] = useState<'light' | 'dark'>('light');

  function openMenu(x: number, y: number) {
    const popup = menu.current;
    if (!popup || typeof popup.showPopover !== 'function') return;
    const theme = document.documentElement.dataset.theme;
    const dark = theme
      ? theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setLogoScheme(dark ? 'dark' : 'light');
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    if (!popup.matches(':popover-open')) popup.showPopover();

    requestAnimationFrame(() => {
      const bounds = popup.getBoundingClientRect();
      const margin = 16;
      popup.style.left = `${Math.min(
        Math.max(margin, x),
        window.innerWidth - bounds.width - margin
      )}px`;
      popup.style.top = `${Math.min(
        Math.max(margin, y),
        window.innerHeight - bounds.height - margin
      )}px`;
      firstMenuItem.current?.focus({ preventScroll: true });
    });
  }

  function openMenuFromKeyboard() {
    const bounds = markButton.current?.getBoundingClientRect();
    if (bounds) openMenu(bounds.left, bounds.bottom + 8);
  }

  function hideMenu() {
    const popup = menu.current;
    if (popup?.matches(':popover-open')) popup.hidePopover();
  }

  function closeMenu() {
    hideMenu();
    markButton.current?.focus({ preventScroll: true });
  }

  // Each page's top bar registers itself while it is on screen, so the
  // observer follows it from page to page and is dropped for pages without
  // one.
  useEffect(() => {
    if (!header) {
      const frame = requestAnimationFrame(() => setRevealed(false));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) =>
      setRevealed(!entry.isIntersecting)
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, [header]);

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = () => menu.current?.hidePopover();
    const dismissOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target)
      ) {
        dismiss();
      }
    };
    window.addEventListener('pointerdown', dismissOutside);
    window.addEventListener('scroll', dismiss, { passive: true });
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('pointerdown', dismissOutside);
      window.removeEventListener('scroll', dismiss);
      window.removeEventListener('resize', dismiss);
    };
  }, [menuOpen]);

  return (
    <>
      <p
        className="site-footer__lockup text-headline-small font-semibold text-ink"
        data-revealed={revealed}
      >
        <button
          ref={markButton}
          type="button"
          className="site-footer__mark-button"
          aria-label="Toggle cube color"
          aria-pressed={colorPinned}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setColorPinned((pinned) => !pinned)}
          onContextMenu={(event) => {
            event.preventDefault();
            openMenu(event.clientX, event.clientY);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'ContextMenu' ||
              (event.key === 'F10' && event.shiftKey)
            ) {
              event.preventDefault();
              openMenuFromKeyboard();
            }
          }}
        >
          <Mark className="site-footer__mark" />
        </button>
        <span className="site-footer__wordmark" data-footer-name>
          {name}
        </span>
      </p>
      <div
        ref={menu}
        id={menuId}
        popover="manual"
        role="menu"
        aria-label="Cube actions"
        className="site-popover cube-context-popover"
        onToggle={(event) => setMenuOpen(event.newState === 'open')}
        onKeyDown={(event) => {
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              '[role="menuitem"]'
            )
          );
          const current = items.indexOf(document.activeElement as HTMLElement);

          if (event.key === 'Escape') {
            event.preventDefault();
            closeMenu();
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            items[(current + step + items.length) % items.length]?.focus();
          } else if (event.key === 'Home') {
            event.preventDefault();
            items[0]?.focus();
          } else if (event.key === 'End') {
            event.preventDefault();
            items[items.length - 1]?.focus();
          }
        }}
        onBlur={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          ) {
            return;
          }
          requestAnimationFrame(() => {
            if (!menu.current?.contains(document.activeElement)) {
              menu.current?.hidePopover();
            }
          });
        }}
      >
        <ul className="cube-context-popover__items">
          <li role="none">
            <a
              ref={firstMenuItem}
              role="menuitem"
              href={`/brand/mark/png/williecubed-cube-on-${logoScheme}-512.png`}
              download={`williecubed-cube-on-${logoScheme}-512.png`}
              className="cube-context-popover__link"
              onClick={hideMenu}
            >
              Download logo PNG
            </a>
          </li>
          <li role="none">
            <SiteLink
              role="menuitem"
              preview={false}
              href="/brand"
              className="cube-context-popover__link"
              onClick={hideMenu}
            >
              Brand page
            </SiteLink>
          </li>
        </ul>
      </div>
    </>
  );
}
