'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

/** Content becomes usable immediately; its skeleton fades independently. */
interface StudioDocumentTransitionProps {
  ready: boolean;
  pending: ReactNode;
  children: ReactNode;
}

export default function StudioDocumentTransition({
  ready,
  pending,
  children,
}: StudioDocumentTransitionProps) {
  const [opening, setOpening] = useState(true);
  const outgoing = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ready || !opening) return;
    let active = true;
    const animations = outgoing.current?.getAnimations() ?? [];
    void Promise.all(
      animations.map((animation) => animation.finished.catch(() => {}))
    ).then(() => {
      if (active) setOpening(false);
    });
    return () => {
      active = false;
    };
  }, [ready, opening]);
  return (
    <div className="studio-document-transition">
      <div
        className="studio-document-reveal"
        data-ready={ready || undefined}
        aria-hidden={!ready || undefined}
        inert={!ready || undefined}
      >
        {children}
      </div>
      {opening && (
        <div
          ref={outgoing}
          className="studio-document-opening"
          data-leaving={ready || undefined}
          aria-hidden={ready || undefined}
          inert={ready || undefined}
        >
          {pending}
        </div>
      )}
    </div>
  );
}
