import { brandSeeds } from '@/lib/brand/scheme';

import { OWNERS } from './owners';
import type { Project } from './schema';

type SeedTable = Record<string, { hex: string } | undefined>;

/**
 * The `#rrggbb` a project page builds its Material 3 scheme from: the
 * project's own `brand`, then a seed the resolver found on the project's
 * own site (keyed by slug), then its first owner that has one. Without
 * any of those the page stays neutral.
 */
export function projectSeed(
  project: Pick<Project, 'slug' | 'brand' | 'owners'>,
  table: SeedTable = brandSeeds as SeedTable
): string | undefined {
  const fromKey = (key?: string) =>
    key?.startsWith('#') ? key : key ? table[key]?.hex : undefined;
  const ownerKey = project.owners
    .map((owner) => (OWNERS[owner] as { brand?: string }).brand)
    .find((brand) => brand && table[brand]);
  return (
    fromKey(project.brand) ?? table[project.slug]?.hex ?? fromKey(ownerKey)
  );
}
