/**
 * What Willie is working toward, in his own words: the rail's list on the
 * homepage. The grid beside it shows the work itself, and each tile names
 * the focuses it serves (`focuses` in lib/home/ventures.ts, or `feature`
 * in an initiative's frontmatter), so this file holds only the lines and
 * their order. A tile can serve no focus; a focus can wait for its first
 * tile, and until then the rail shows it as plain text.
 */

export const FOCUS_IDS = [
  'cities',
  'helpers',
  'lovelace',
  'tools',
  'diaries',
] as const;

export type FocusId = (typeof FOCUS_IDS)[number];

export interface Focus {
  id: FocusId;
  line: string;
  /**
   * The work's own app icons or marks, back to front, from
   * public/assets/home/icon-*.webp (96px squares). They fan out beside the
   * line when it is pointed at.
   */
  icons: string[];
}

/** An icon's file, sized as every icon file is. */
export function iconPicture(name: string) {
  return { src: `/assets/home/icon-${name}.webp`, width: 96, height: 96 };
}

export const focuses: Focus[] = [
  {
    id: 'cities',
    line: 'Fighting for light rail and more walkable neighborhoods',
    icons: ['transitmapper', 'lvbt'],
  },
  {
    id: 'helpers',
    line: 'Finding the helpers throughout the country',
    icons: ['atlas'],
  },
  {
    id: 'lovelace',
    line: 'Building an intelligent computer for everyone',
    icons: ['lovelace'],
  },
  {
    id: 'tools',
    line: 'Building tools to help people plan and live their lives',
    icons: ['hypertext', 'docket', 'logdate'],
  },
  {
    id: 'diaries',
    line: 'Filming a silly little video diary',
    icons: ['diaries'],
  },
];

/** Anything on the grid that can serve a focus. */
export interface FocusedTile {
  id: string;
  focuses: readonly FocusId[];
}

/**
 * Each focus's tiles, in grid order. A focus with none is not live: the
 * rail shows it without a way to point at it.
 */
export function tilesByFocus(
  tiles: readonly FocusedTile[]
): Record<FocusId, string[]> {
  const byFocus = Object.fromEntries(
    FOCUS_IDS.map((id) => [id, [] as string[]])
  ) as Record<FocusId, string[]>;
  for (const tile of tiles) {
    for (const focus of tile.focuses) byFocus[focus].push(tile.id);
  }
  return byFocus;
}
