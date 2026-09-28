import kitJson from './kit.json';

/**
 * The brand kit that /brand lists. `pnpm brand:build` writes kit.json next
 * to the files it generates under public/brand, so the page never names a
 * file or a size by hand.
 */

export interface KitDownload {
  label: string;
  /** A path under /brand, served from public/brand. */
  href: string;
  bytes: number;
}

export interface KitFile {
  /** The path inside its group, as the kit's folders spell it. */
  name: string;
  href: string;
  bytes: number;
  purpose: string;
}

/** A box in a file's own units. */
export interface KitBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How a file may be placed. Every logo file ends where its drawing ends, so
 * clear space is measured out from the file's edge.
 */
export interface KitUsage {
  kind: 'tile' | 'square' | 'cube' | 'lockup' | 'wordmark';
  background: 'any' | 'light' | 'dark';
  /** The SVG's own size. */
  width: number;
  height: number;
  /** A platform crops it, so it has no placement rules of its own. */
  platformOnly?: boolean;
  /** The cube's drawn box inside the file; the wordmark has none. */
  cube?: KitBox;
  /** x in the file's units, and as a share of its width and height. */
  clearSpace?: { x: number; ofWidth: number; ofHeight: number };
  /** The smallest height on screen, in CSS pixels, and in print. */
  minSize?: { px: number; mm: number };
}

export interface KitMark {
  name: string;
  label: string;
  note: string;
  /** Drawn for a dark background, so its preview sits on ink. */
  dark: boolean;
  preview: string;
  downloads: KitDownload[];
  /** The cut with wider gaps for small sizes, when the mark has one. */
  small?: { preview: string; downloads: KitDownload[] };
  usage: KitUsage;
}

export interface KitLockup {
  name: string;
  label: string;
  note: string;
  dark: boolean;
  preview: string;
  /** The SVG's own size. */
  width: number;
  height: number;
  /** The label's cap height, in the SVG's own units. */
  cap: number;
  downloads: KitDownload[];
  usage: KitUsage;
}

/** The rules that apply across files, shared with guidelines.json. */
export interface KitRules {
  /** x as a share of the cube's drawn height. */
  clearSpace: number;
  /** At or below this height in CSS pixels, a mark switches to its small cut. */
  smallMaxPx: number;
  selection: Array<{
    when: string;
    use: Array<{ name: string; label: string; background: string }>;
    note?: string;
  }>;
  prohibited: Array<{ id: string; rule: string; why: string }>;
  exceptions: string[];
  /** Page-only images, left out of the kit. */
  guide: { regular16: string };
  guidelines: KitDownload[];
}

export interface KitColor {
  key: string;
  name: string;
  role: string;
  hex: string;
  rgb: string;
  oklch: string;
}

export interface KitAppIcon {
  appearance: string;
  preview: string;
  downloads: KitDownload[];
}

export interface Kit {
  archive: KitDownload;
  marks: KitMark[];
  lockups: KitLockup[];
  colors: KitColor[];
  tokens: KitDownload[];
  /** Empty when the kit was built without Xcode 26 to render Liquid Glass. */
  appIcons: KitAppIcon[];
  platforms: Array<{ title: string; files: KitFile[] }>;
  usage: KitRules;
}

export const kit: Kit = kitJson as Kit;

/** A kit color's hex by its key, such as `paper` or `ink`. */
export function kitColor(key: string, source: Kit = kit): string {
  const color = source.colors.find((entry) => entry.key === key);
  if (!color) throw new Error(`The brand kit has no ${key} color`);
  return color.hex;
}

/** Every file the kit links to, for checks that each one is really there. */
export function kitHrefs(source: Kit = kit): KitDownload[] {
  return [
    source.archive,
    ...source.marks.flatMap((mark) => [
      ...mark.downloads,
      ...(mark.small?.downloads ?? []),
    ]),
    ...source.usage.guidelines,
    ...source.lockups.flatMap((lockup) => lockup.downloads),
    ...source.tokens,
    ...source.appIcons.flatMap((icon) => icon.downloads),
    ...source.platforms.flatMap((group) =>
      group.files.map(({ name, href, bytes }) => ({ label: name, href, bytes }))
    ),
  ];
}

/** A file size the way the download chips print it. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576)
    return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * The corner of Apple's continuous rounded rectangle, the shape iOS masks an
 * app icon with, as offsets from the top-right corner in units of the
 * corner radius. It is three curves joined by two short lines, and unlike a
 * circular corner its curvature eases in from the straight edge.
 */
const CORNER: Array<[x: number, y: number][]> = [
  [[1.52866471, 0]],
  [
    [1.08849323, 0],
    [0.86840689, 0],
    [0.66993427, 0.065496],
  ],
  [[0.63149399, 0.074911]],
  [
    [0.37282392, 0.16905899],
    [0.16905899, 0.37282392],
    [0.074911, 0.63149399],
  ],
  [[0.065496, 0.66993427]],
  [
    [0, 0.86840689],
    [0, 1.08849323],
    [0, 1.52866483],
  ],
];

/** iOS draws an app icon's corner radius at this fraction of its width. */
export const IOS_ICON_RADIUS = 0.2237;

/**
 * The iOS app icon outline as an SVG path in a unit square, drawn clockwise
 * from the top edge. Each corner is the top-right one turned a quarter at a
 * time about the centre.
 */
export function iosIconPath(radius = IOS_ICON_RADIUS): string {
  const round = (n: number) => Number(n.toFixed(5));
  const turn = ([x, y]: [number, number], quarters: number) => {
    let point: [number, number] = [x, y];
    for (let i = 0; i < quarters; i++) point = [1 - point[1], point[0]];
    return point.map(round).join(' ');
  };
  let d = `M${turn([radius * 1.52866483, 0], 0)}`;
  for (let quarter = 0; quarter < 4; quarter++) {
    for (const segment of CORNER) {
      const points = segment.map(([dx, dy]) =>
        turn([1 - dx * radius, dy * radius], quarter)
      );
      d += `${points.length === 1 ? 'L' : 'C'}${points.join(' ')}`;
    }
  }
  return `${d}Z`;
}

/**
 * A CSS mask that trims an opaque, full-bleed icon render to the iOS
 * outline, stretched to whatever box it is applied to.
 */
export function iosIconMask(radius = IOS_ICON_RADIUS): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><path d="${iosIconPath(radius)}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
