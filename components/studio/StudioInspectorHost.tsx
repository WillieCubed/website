'use client';

import { type ReactNode, createContext, useState } from 'react';

/** Each cached writing owns its portal host; hidden routes cannot capture settings. */
export const StudioInspectorHostContext = createContext<HTMLDivElement | null>(
  null
);

interface StudioInspectorHostProps {
  children: ReactNode;
}

export default function StudioInspectorHost({
  children,
}: StudioInspectorHostProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <StudioInspectorHostContext value={host}>
      <div ref={setHost} data-studio-inspector-host />
      {children}
    </StudioInspectorHostContext>
  );
}
