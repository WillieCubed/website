import { materialSchemeVars } from '@/lib/brand/material-scheme';

import type { EntityCard } from './types';

/** Prepare each distinct palette once before sending previews to the browser. */
export function prepareEntityPreviews(cards: EntityCard[]): EntityCard[] {
  const schemes = new Map<string, ReturnType<typeof materialSchemeVars>>();
  return cards.map((card) => {
    if (!card.brand) return card;
    let scheme = schemes.get(card.brand);
    if (!scheme) {
      scheme = materialSchemeVars(card.brand);
      schemes.set(card.brand, scheme);
    }
    return { ...card, scheme };
  });
}
