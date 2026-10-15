'use client';
import { type RefObject, useLayoutEffect, useRef } from 'react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';

import type { MusicMode } from '@/lib/music/presentation';

interface Props {
  visible: boolean;
  mode: MusicMode;
  changed: boolean;
  published?: boolean;
  storageError: string;
  saveStatus?: string;
  loading: boolean;
  canReview?: boolean;
  reviewTrigger: RefObject<HTMLButtonElement | null>;
  onReview: () => void;
}
export default function MusicPublicationBar({
  visible,
  mode,
  changed,
  published = false,
  storageError,
  saveStatus,
  loading,
  canReview = true,
  reviewTrigger,
  onReview,
}: Props) {
  const publicationBar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!visible || !publicationBar.current) return;
    const bar = publicationBar.current;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('--music-publication-height');
    const update = () => {
      root.style.setProperty(
        '--music-publication-height',
        `${Math.ceil(bar.getBoundingClientRect().height)}px`
      );
      const focused = document.activeElement;
      const bounds = bar.getBoundingClientRect();
      if (
        focused instanceof HTMLElement &&
        focused.closest('.mp-grid') &&
        focused.getBoundingClientRect().top < bounds.bottom &&
        focused.getBoundingClientRect().bottom > bounds.top - 16
      ) {
        focused.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    };
    update();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(bar);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      if (previous)
        root.style.setProperty('--music-publication-height', previous);
      else root.style.removeProperty('--music-publication-height');
    };
  }, [visible, saveStatus, loading, published]);

  if (!visible) return null;
  return (
    <div
      ref={publicationBar}
      className="mp-draft-note"
      role="region"
      aria-label="Collection publication"
    >
      <span className="mp-status-dot" />
      <PublicationSummary
        mode={mode}
        changed={changed}
        published={published}
        storageError={storageError}
        saveStatus={saveStatus}
      />
      <Button
        variant={changed ? 'primary' : 'tonal'}
        ref={reviewTrigger}
        disabled={loading || (mode === 'prototype' ? !changed : !canReview)}
        onClick={onReview}
      >
        Review changes
        <Icon name="arrow-right" />
      </Button>
    </div>
  );
}

interface SummaryProps {
  mode: MusicMode;
  changed: boolean;
  published: boolean;
  storageError: string;
  saveStatus?: string;
}
function PublicationSummary({
  mode,
  changed,
  published,
  storageError,
  saveStatus,
}: SummaryProps) {
  return (
    <>
      <span>
        {mode === 'prototype'
          ? changed
            ? 'Unapplied changes'
            : 'No unapplied changes'
          : published
            ? 'Live collection'
            : 'Private draft'}
      </span>
      <small>
        {mode === 'prototype'
          ? storageError
            ? 'This tab only'
            : 'Saved in this browser'
          : published
            ? 'On willie.page'
            : saveStatus}
      </small>
    </>
  );
}
