import type { ReactElement } from 'react';

import { ViewTransition } from './view-transition';

interface SharedTitleProps {
  /** The same on both pages, such as `initiative-fall-tour-2026`. */
  id: string;
  /**
   * Which end of the morph this title is. The group draws only the larger
   * title's snapshot (app/globals.css), so text never grows out of a small
   * raster and two copies never fade into each other.
   */
  size: 'small' | 'large';
  /** One element that fits its text, so the snapshot is the words alone. */
  children: ReactElement;
}

/**
 * A title that stands for the same thing on two pages, such as a homepage
 * tile's name and the initiative page's heading. A navigation between them
 * morphs one into the other (docs/design-principles.md, Fluid). React
 * names the element only while such a navigation runs, so the palette's and
 * the detail view's own transitions never see it.
 */
export default function SharedTitle({ id, size, children }: SharedTitleProps) {
  return (
    <ViewTransition
      name={`title-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
      share={`title-${size}`}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
