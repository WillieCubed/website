/** Stable identities keep these references attached when playlist titles change. */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  '7qgLqpNN5w1KwOnhEVojqz': ['main character'],
  '1CrRioD0EmSlk5jyndh6Oz': ['roll credits'],
  '732snle3EiiBBSEYEyJzYv': ['get to the point'],
};

export function musicAliases(id: string): string[] {
  return [...(ALIASES[id] ?? [])];
}

export function offersCredits(id: string): boolean {
  return id === '1CrRioD0EmSlk5jyndh6Oz';
}
