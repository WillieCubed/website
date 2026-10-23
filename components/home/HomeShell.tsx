'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type { BrandSchemes } from '@/lib/brand/scheme';
import type { FocusId } from '@/lib/home/focuses';
import { entries } from '@/lib/home/ventures';

import { DetailDialog } from './DetailDialog';
import {
  type HomeActions,
  HomeActionsContext,
  HomeContext,
  type HomePreviewState,
  type Preview,
} from './HomeContext';

// Leaving one tile fires before entering the next, so clearing right away
// would flash the whole grid back into focus while the pointer crosses the
// gap between tiles. The clear waits long enough for the next enter.
const LEAVE_DEBOUNCE_MS = 120;

interface HomeFocusEntry {
  focuses: FocusId[];
}

interface HomeShellProps {
  initialDetail?: string;
  brands: BrandSchemes;
  /** The server-rendered LVBT countdown for the detail view. */
  detailCountdown: React.ReactNode;
  /** Focuses for tiles that are not ventures, such as featured initiatives. */
  extraEntries?: Record<string, HomeFocusEntry>;
  children: React.ReactNode;
}

/**
 * Owns what the visitor is pointing at and hands it to the rail, the tiles,
 * and the detail view through context.
 */
export function HomeShell({
  brands,
  initialDetail,
  detailCountdown,
  extraEntries = {},
  children,
}: HomeShellProps) {
  const [preview, setPreviewState] = useState<Preview>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opener = useRef<HomeActions['openDetail'] | null>(null);

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

  const actions = useMemo<HomeActions>(
    () => ({
      setPreview,
      clearPreview,
      clearPreviewNow,
      brands,
      openDetail: (id, from) => {
        if (opener.current) opener.current(id, from);
        else window.location.assign(`/?detail=${encodeURIComponent(id)}`);
      },
    }),
    [setPreview, clearPreview, clearPreviewNow, brands]
  );
  const dialog = useMemo(
    () => (
      <DetailDialog
        initialId={initialDetail}
        countdown={detailCountdown}
        registerOpener={(open) => {
          opener.current = open;
        }}
      />
    ),
    [initialDetail, detailCountdown]
  );

  const value = useMemo<HomePreviewState>(() => {
    const focusesOf = (id: string) =>
      entries[id]?.focuses ?? extraEntries[id]?.focuses;
    const matches = (id: string) => {
      const focuses = focusesOf(id);
      if (!preview || focuses == null) return false;
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
      matches,
      lit,
    };
  }, [preview, extraEntries]);

  return (
    <HomeActionsContext value={actions}>
      <HomeContext value={value}>
        <div className="home">
          <div
            className={
              !preview
                ? 'shell'
                : 'focus' in preview && preview.pinned
                  ? 'shell focusing pinned'
                  : 'shell focusing'
            }
          >
            {children}
          </div>
          {dialog}
        </div>
      </HomeContext>
    </HomeActionsContext>
  );
}
