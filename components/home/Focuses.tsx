'use client';

import type { FocusId } from '@/lib/home/focuses';

import { isFocusPressed, useHome, usePreviewHandlers } from './HomeContext';

export interface FocusItem {
  id: FocusId;
  line: string;
  /** Whether any tile on the grid serves this focus. */
  live: boolean;
  /** The first such tile's brand scheme, taken on while the row is active. */
  style?: React.CSSProperties;
  /** Its icons, back to front, fanned out on hover. */
  stack: StackPicture[];
}

export interface StackPicture {
  src: string;
  width?: number;
  height?: number;
}

/**
 * A focus with work on the grid: pointing at it or focusing it lights its
 * tiles. A mouse previews on hover, so a click adds nothing; a tap has no
 * hover to end it, so a second tap clears it. A tap also fires the pointer
 * and focus events a hover would, so those preview only for a mouse and a
 * keyboard, or the tap would switch the focus on and then straight off.
 */
function LiveFocus({ focus }: { focus: FocusItem }) {
  const { preview, lit, setPreview, clearPreviewNow } = useHome();
  const { onPointerEnter, onPointerLeave, onFocus, onBlur } =
    usePreviewHandlers({ focus: focus.id });
  const handlers = {
    onPointerEnter: (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse') onPointerEnter();
    },
    onPointerLeave: (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse') onPointerLeave();
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      if (event.currentTarget.matches(':focus-visible')) onFocus();
    },
    onBlur,
  };
  const pressed = isFocusPressed(preview, focus.id);
  return (
    <button
      type="button"
      className={lit.includes(focus.id) ? 'focus hit' : 'focus'}
      data-focus={focus.id}
      data-branded={focus.style ? '' : undefined}
      style={focus.style}
      aria-pressed={pressed}
      {...handlers}
      onClick={(event) => {
        if ((event.nativeEvent as PointerEvent).pointerType === 'mouse') return;
        if (pressed) {
          clearPreviewNow();
        } else {
          setPreview({ focus: focus.id });
        }
      }}
    >
      <Stack pictures={focus.stack} />
      <span className="focus-line">{focus.line}</span>
    </button>
  );
}

/**
 * The work's icons, stacked. Decorative: the line beside them already says
 * what the work is. The rail is on the first screen at every size, so they
 * load eagerly.
 */
function Stack({ pictures }: { pictures: StackPicture[] }) {
  return (
    <span className="stack" aria-hidden="true">
      {pictures.map((image) => (
        <i key={image.src}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            width={image.width}
            height={image.height}
            alt=""
            decoding="async"
          />
        </i>
      ))}
    </span>
  );
}

/** The rail's list of what Willie is working toward. */
export function Focuses({ items }: { items: FocusItem[] }) {
  return (
    <section className="focuses" aria-labelledby="focuses-heading">
      <h2 id="focuses-heading">Focuses</h2>
      <ul>
        {items.map((focus) => (
          <li key={focus.id}>
            {focus.live ? (
              <LiveFocus focus={focus} />
            ) : (
              // Nothing on the grid serves it yet, so it is only a line of
              // text: no container, nothing to point at.
              <span className="focus">
                <Stack pictures={focus.stack} />
                <span className="focus-line">{focus.line}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A venture's name in the rail's description. It opens the venture's detail
 * view in place, growing out of the name, and falls back to the same view by
 * URL without scripting.
 */
export function VentureLink({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { openDetail } = useHome();
  return (
    <a
      href={`?detail=${id}`}
      className="venture-link"
      onClick={(event) => {
        event.preventDefault();
        openDetail(id, event.currentTarget);
      }}
    >
      {children}
    </a>
  );
}
