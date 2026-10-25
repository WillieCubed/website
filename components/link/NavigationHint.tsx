'use client';

import { useLinkStatus } from 'next/link';
import { useEffect, useState } from 'react';

import ViewportPortal from '@/components/site/ViewportPortal';

/** A delayed, out-of-flow acknowledgement leaves the current page usable. */
export default function NavigationHint() {
  const { pending } = useLinkStatus();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    if (!pending) return;
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, [pending]);
  if (!pending) return null;
  return (
    <ViewportPortal>
      <span
        className="site-navigation-hint"
        data-pending={visible || undefined}
        role="status"
      >
        <span className="sr-only">{visible ? 'Opening page…' : ''}</span>
      </span>
    </ViewportPortal>
  );
}
