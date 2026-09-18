'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';

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
  children: React.ReactNode;
}

/**
 * Owns what the visitor is pointing at and hands it to the rail, the tiles,
 * and the detail view through context.
 */
export function HomeShell({
  brands,
  detailCountdown,
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
    const matches = (id: string) => {
      const entry = entries[id];
      if (!preview || !entry) return false;
      return 'facet' in preview
        ? entry.facets.includes(preview.facet)
        : entry.id === preview.id;
    };
    const lit = !preview
      ? []
      : 'facet' in preview
        ? [preview.facet]
        : (entries[preview.id]?.facets ?? []);
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
  }, [preview, setPreview, clearPreview, clearPreviewNow, brands]);

  const accent =
    preview && 'id' in preview
      ? brands[entries[preview.id]?.brand]?.['--b-primary']
      : undefined;

  return (
    <HomeContext value={value}>
      <div className="home">
        <div
          className={preview ? 'shell focusing' : 'shell'}
          style={
            accent
              ? ({ '--live-accent': accent } as React.CSSProperties)
              : undefined
          }
        >
          {children}
        </div>
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
