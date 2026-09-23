'use client';

import type { Facet } from '@/lib/home/ventures';

import { isFacetPressed, useHome, usePreviewHandlers } from './HomeContext';

/** A live word in the headline that lights the tiles sharing its facet. */
export function FacetKey({
  facet,
  children,
}: {
  facet: Facet;
  children: React.ReactNode;
}) {
  const { lit, preview, setPreview, clearPreviewNow } = useHome();
  const handlers = usePreviewHandlers({ facet });
  const pressed = isFacetPressed(preview, facet);
  return (
    <button
      type="button"
      className={lit.includes(facet) ? 'key lit' : 'key'}
      data-facet={facet}
      aria-pressed={pressed}
      {...handlers}
      onClick={(event) => {
        // A mouse already previews on hover, so a click has nothing to add.
        // A tap has no hover to end it, so a second tap clears it.
        if ((event.nativeEvent as PointerEvent).pointerType === 'mouse') return;
        if (pressed) {
          clearPreviewNow();
        } else {
          setPreview({ facet });
        }
      }}
    >
      {children}
    </button>
  );
}
