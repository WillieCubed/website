'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';

import type { FocusId } from '@/lib/home/focuses';
import { entries } from '@/lib/home/ventures';

import { DetailDialog } from './DetailDialog';
import {
  HomeContext,
  type HomeContextValue,
  type Preview,
} from './HomeContext';

// Leaving one tile fires before entering the next, so clearing right away
// would flash the whole grid back into focus while the pointer crosses the
// gap between tiles. The clear waits long enough for the next enter.
const LEAVE_DEBOUNCE_MS = 120;

interface HomeShellProps {
  brands: Record<string, Record<string, string>>;
  /** The server-rendered LVBT countdown for the detail view. */
  detailCountdown: React.ReactNode;
  /** Focuses for tiles that are not ventures, such as featured initiatives. */
  extraEntries?: Record<string, { focuses: FocusId[] }>;
  children: React.ReactNode;
}

/**
 * Owns what the visitor is pointing at and hands it to the rail, the tiles,
 * and the detail view through context.
 */
export function HomeShell({
  brands,
  detailCountdown,
  extraEntries = {},
  children,
}: HomeShellProps) {
  const [preview, setPreviewState] = useState<Preview>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opener = useRef<HomeContextValue['openDetail']>(() => {});

  const cancelClear = () => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = null;
  };
  const setPreview = useCallback((value: Preview) => {
    cancelClear();
    setPreviewState(value);
  }, []);
  const clearPreview = useCallback(() => {
    cancelClear();
    clearTimer.current = setTimeout(
      () => setPreviewState(null),
      LEAVE_DEBOUNCE_MS
    );
  }, []);
  const clearPreviewNow = useCallback(() => setPreview(null), [setPreview]);

  const value = useMemo<HomeContextValue>(() => {
    const focusesOf = (id: string) =>
      entries[id]?.focuses ?? extraEntries[id]?.focuses;
    const matches = (id: string) => {
      const focuses = focusesOf(id);
      if (!preview || !focuses) return false;
      return 'focus' in preview
        ? focuses.includes(preview.focus)
        : id === preview.id;
    };
    const lit = !preview
      ? []
      : 'focus' in preview
        ? [preview.focus]
        : (focusesOf(preview.id) ?? []);
    return {
      preview,
      setPreview,
      clearPreview,
      clearPreviewNow,
      matches,
      lit,
      openDetail: (id, from) => opener.current(id, from),
      brands,
    };
  }, [
    preview,
    setPreview,
    clearPreview,
    clearPreviewNow,
    brands,
    extraEntries,
  ]);

  return (
    <HomeContext value={value}>
      <div className="home">
        <div className={preview ? 'shell focusing' : 'shell'}>{children}</div>
        <Suspense fallback={null}>
          <DetailDialog
            registerOpener={(open) => {
              opener.current = open;
            }}
            countdown={detailCountdown}
          />
        </Suspense>
      </div>
    </HomeContext>
  );
}
