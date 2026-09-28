import {
  currentPart,
  getFeaturedInitiatives,
  getInitiatives,
} from '@/lib/initiatives';
import { schemeStyleFromHex } from '@/lib/initiatives/theme';

import type { InitiativeTile } from './ventures';

/**
 * Featured initiatives as homepage tiles. Weight, size, hint, and focuses
 * come from each initiative's `feature` block, so moving one on the
 * homepage is an edit to its frontmatter (docs/initiatives.md).
 */
export async function getFeaturedTiles(): Promise<InitiativeTile[]> {
  const featured = await getFeaturedInitiatives();
  // A parent such as The Willie Diaries has no tile of its own, so the
  // lookup covers every published initiative, not only featured ones.
  const parents = new Map((await getInitiatives()).map((i) => [i.slug, i]));
  return featured.flatMap((initiative) => {
    const feature = initiative.feature;
    if (!feature) return [];
    const vars = schemeStyleFromHex(initiative.brand);
    const act = currentPart(initiative);
    return [
      {
        id: `initiative-${initiative.slug}`,
        kind: 'initiative' as const,
        weight: feature.weight,
        size: feature.size,
        name: initiative.title,
        parent: initiative.parent
          ? parents.get(initiative.parent)?.title
          : undefined,
        hint: feature.hint,
        href: initiative.href,
        tagline: act
          ? `${initiative.partLabel} ${act.number} · ${act.title}`
          : initiative.tagline,
        focuses: feature.focuses,
        brandVars: Object.keys(vars).length
          ? (vars as Record<string, string>)
          : undefined,
        image: initiative.cover,
        body: initiative.parts.length > 0 ? 'playbill' : 'cover',
      },
    ];
  });
}

/** Focus lookups for the shell, keyed like the ventures. */
export function focusEntries(tiles: InitiativeTile[]) {
  return Object.fromEntries(
    tiles.map((tile) => [tile.id, { focuses: tile.focuses }])
  );
}
