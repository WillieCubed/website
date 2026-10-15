'use client';

import { useLinkStatus } from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** A delayed, out-of-flow acknowledgement leaves the current page usable. */
export default function NavigationHint() {
  const { pending } = useLinkStatus();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, [pending]);
  if (!pending || typeof document === 'undefined') return null;
  return createPortal(
    <span
      className="site-navigation-hint"
      data-pending={(pending && visible) || undefined}
      role="status"
    >
      <span className="sr-only">
        {pending && visible ? 'Opening page…' : ''}
      </span>
    </span>,
    document.body
  );
}
