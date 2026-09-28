import type { WritingData } from '@/lib/writings';
import { groupByTag, tagPath, writingCount } from '@/lib/writings/tags';

import type { EntityCard } from './types';

/**
 * One card per tag the given writings carry, titled with the tag and
 * described by how many writings carry it. Hover cards and site search
 * both read these, so pass published writings only.
 */
export function tagCards(writings: WritingData[]): EntityCard[] {
  return groupByTag(writings).map(({ tag, writings: tagged }) => ({
    href: tagPath(tag),
    kind: 'tag',
    title: tag,
    description: writingCount(tagged.length),
  }));
}
