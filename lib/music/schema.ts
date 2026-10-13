import { z } from 'zod';

import type { MusicCatalog } from './types';

const spotifyId = z.string().regex(/^[A-Za-z0-9]{22}$/);
const ids = z
  .array(spotifyId)
  .max(10000)
  .refine(
    (values) => new Set(values).size === values.length,
    'Playlist identifiers must be unique.'
  );
const catalogSchema = z.strictObject({
  version: z.literal(1),
  order: ids,
  selected: ids,
  lead: spotifyId.nullable(),
  series: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z0-9-]{1,100}$/),
        title: z.string().trim().min(1).max(160),
        playlistIds: ids,
      })
    )
    .max(200),
  notes: z.record(spotifyId, z.string().max(10000)),
});
export function parseCatalog(value: unknown, known?: string[]): MusicCatalog {
  const c = catalogSchema.parse(value);
  const order = new Set(c.order);
  if (
    c.selected.some((id) => !order.has(id)) ||
    (c.lead !== null && !c.selected.includes(c.lead)) ||
    c.series.some((s) => s.playlistIds.some((id) => !order.has(id))) ||
    Object.keys(c.notes).some((id) => !order.has(id)) ||
    new Set(c.series.map((s) => s.id)).size !== c.series.length
  )
    throw new Error('The catalog contains invalid membership.');
  if (
    known &&
    (c.order.some((id) => !known.includes(id)) ||
      known.some((id) => !order.has(id)))
  )
    throw new Error(
      'The catalog does not match the imported library. Reload the library.'
    );
  return c;
}
export function publicCatalog(value: MusicCatalog): MusicCatalog {
  const c = parseCatalog(value),
    selected = new Set(c.selected);
  return {
    ...c,
    order: c.order.filter((id) => selected.has(id)),
    notes: Object.fromEntries(
      Object.entries(c.notes).filter(([id]) => selected.has(id))
    ),
    series: c.series
      .map((s) => ({
        ...s,
        playlistIds: s.playlistIds.filter((id) => selected.has(id)),
      }))
      .filter((s) => s.playlistIds.length),
  };
}
