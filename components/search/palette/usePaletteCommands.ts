import { useCallback, useRef, useState } from 'react';

import type { Command } from '@/lib/search/palette/types';

/** Keeps page commands registered for exactly their owner's mounted lifetime. */
export function usePaletteCommands() {
  const commandRegistry = useRef(new Map<symbol, Command[]>());
  const [contextCommands, setContextCommands] = useState<Command[]>([]);
  const registerCommands = useCallback((commands: Command[]) => {
    const key = Symbol('palette commands');
    commandRegistry.current.set(key, commands);
    setContextCommands([...commandRegistry.current.values()].flat());
    return () => {
      commandRegistry.current.delete(key);
      setContextCommands([...commandRegistry.current.values()].flat());
    };
  }, []);

  return { contextCommands, registerCommands };
}
