'use client';

import { useEffect } from 'react';

import { setFooterDocked } from '@/lib/footer/docked';

/**
 * Rendered by the homepage to say that the footer is its contact row until
 * the page ends. It says so for exactly as long as the page is mounted, so
 * the footer goes back to its plain self on the way out, and no one has to
 * work out from the markup which page is on screen.
 */
export default function DockFooter() {
  useEffect(() => {
    setFooterDocked(true);
    return () => setFooterDocked(false);
  }, []);

  return null;
}
