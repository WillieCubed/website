'use client';
import { useRef } from 'react';

interface Options {
  enabled: boolean;
  onDrop: (source: string, target: string) => void;
}

/** Disabled drops leave the gesture intact; an accepted drop consumes it once. */
export function useMusicPlaylistDrag({ enabled, onDrop }: Options) {
  const source = useRef<string | null>(null);
  function start(id: string) {
    source.current = id;
  }
  function drop(target: string) {
    if (!enabled) return;
    const from = source.current;
    source.current = null;
    if (!from || from === target) return;
    onDrop(from, target);
  }
  return { start, drop };
}
