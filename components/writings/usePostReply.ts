import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/** Reply disclosure owns its transition, responsive menu and focus restoration. */
export function usePostReply() {
  const [replyOpen, setReplyOpen] = useState(false);
  const replyId = useId();
  const replySurface = useRef<HTMLDivElement>(null);
  const replyTrigger = useRef<HTMLDivElement>(null);
  const transitioning = useRef(false);

  useEffect(() => {
    const expanded = window.matchMedia('(min-width: 600px)');
    function showExpandedDestinations() {
      const menu =
        replyTrigger.current?.querySelector<HTMLElement>('[popover]');
      if (!expanded.matches || !menu?.matches(':popover-open')) return;
      const restoreFocus = menu.contains(document.activeElement);
      menu.hidePopover();
      if (restoreFocus) replyTrigger.current?.querySelector('button')?.focus();
    }
    expanded.addEventListener('change', showExpandedDestinations);
    return () =>
      expanded.removeEventListener('change', showExpandedDestinations);
  }, []);

  async function toggleReply() {
    if (transitioning.current) return;
    const opening = !replyOpen;
    const surface = replySurface.current;
    if (
      document.startViewTransition == null ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !surface
    ) {
      setReplyOpen(opening);
      requestAnimationFrame(() =>
        (opening
          ? surface?.querySelector('input')
          : replyTrigger.current?.querySelector('button')
        )?.focus()
      );
      return;
    }

    transitioning.current = true;
    document.documentElement.dataset.postReplyTransition = '';
    surface.style.viewTransitionName = 'post-reply';
    try {
      const started = document.startViewTransition(() => {
        flushSync(() => setReplyOpen(opening));
      });
      // ready rejects alongside finished when the browser cancels, and
      // only finished is awaited here.
      started.ready.catch(() => undefined);
      await started.finished;
      (opening
        ? surface.querySelector('input')
        : replyTrigger.current?.querySelector('button')
      )?.focus();
    } catch {
      // The browser can cancel a transition without cancelling its state update.
    } finally {
      surface.style.viewTransitionName = '';
      delete document.documentElement.dataset.postReplyTransition;
      transitioning.current = false;
    }
  }

  return { replyOpen, replyId, replySurface, replyTrigger, toggleReply };
}
