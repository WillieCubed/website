'use client';
import { useSyncExternalStore } from 'react';

/** A store that never changes: its value only differs between server and client. */
export const subscribeToNothing = () => () => {};

export function useHydrated() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
}
