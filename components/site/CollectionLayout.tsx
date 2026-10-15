import type { PropsWithChildren } from 'react';

import { COLUMN } from './TopBar';
import './styles/collections.css';

/** Collection pages share the title gutter and the card boundary. */
export default function CollectionLayout({
  children,
  className = '',
}: PropsWithChildren<{ className?: string }>) {
  return (
    <main
      id="main"
      className={`site-collection mx-auto pb-8 ${COLUMN.content} ${className}`}
    >
      {children}
    </main>
  );
}
