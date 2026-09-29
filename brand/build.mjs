// Generates every WillieCubed brand asset, and the manifest the
// willie.page/brand download page renders, from one geometry and one palette.
// Run `pnpm brand:build` after changing either; never edit files under
// public/brand or lib/brand/kit.json by hand.
import { Resvg } from '@resvg/resvg-js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import PDFDocument from 'pdfkit';
import * as prettier from 'prettier';
import SVGtoPDF from 'svg-to-pdfkit';

import { typeScale } from './type-scale.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Every generated file gets this timestamp so rebuilding unchanged assets
// produces byte-identical PDFs and archives.
const BUILD_EPOCH = new Date('2026-01-01T00:00:00Z');
const PUBLIC = path.join(HERE, '..', 'public');
const OUT = path.join(PUBLIC, 'brand');
const BOLD = opentype.loadSync(
  path.join(HERE, 'fonts/AtkinsonHyperlegibleNext-Bold.ttf')
);

const COLOR = {
  green: {
    hex: '#2f6f5e',
    name: 'Accent green',
    role: 'The mark’s tile and the site’s accent.',
  },
  ink: {
    hex: '#1c231e',
    name: 'Ink',
    role: 'Text and the mark’s shadow facet.',
  },
  paper: {
    hex: '#f4f5ef',
    name: 'Paper',
    role: 'Page background and the mark’s top facet.',
  },
  mint: { hex: '#8fd1b8', name: 'Mint', role: 'The mark’s lit facet.' },
  tray: { hex: '#e7eae2', name: 'Tray', role: 'Card and tile surfaces.' },
  muted: { hex: '#69736b', name: 'Muted', role: 'Secondary text.' },
};
const C = Object.fromEntries(Object.entries(COLOR).map(([k, v]) => [k, v.hex]));

// ---------- Geometry ----------

// Moves every edge of a convex polygon inward by the same distance, which
// shrinks a rhombus without changing its angles.
function inset(points, distance) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  const lines = points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    let nx = q[1] - p[1];
    let ny = p[0] - q[0];
    const length = Math.hypot(nx, ny);
    nx /= length;
    ny /= length;
    if ((cx - p[0]) * nx + (cy - p[1]) * ny < 0) [nx, ny] = [-nx, -ny];
    return [
      [p[0] + nx * distance, p[1] + ny * distance],
      [q[0] + nx * distance, q[1] + ny * distance],
    ];
  });
  return lines.map((line, i) => {
    const [[x1, y1], [x2, y2]] = lines[(i + lines.length - 1) % lines.length];
    const [[x3, y3], [x4, y4]] = line;
    const t =
      ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) /
      ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  });
}

const fmt = (n) => Number(n.toFixed(2));

// An isometric cube is a regular hexagon split into three rhombi meeting at
// its center. Each facet is inset by its corner radius plus half the gap, then
// stroked with round joins, which adds the radius back as rounded corners.
function facets({ cx, cy, r, corner = r * 0.097, gap = r * 0.118 }) {
  const at = (deg) => [
    cx + r * Math.cos((deg * Math.PI) / 180),
    cy + r * Math.sin((deg * Math.PI) / 180),
  ];
  const [top, upperRight, lowerRight, bottom, lowerLeft, upperLeft] = [
    -90, -30, 30, 90, 150, 210,
  ].map(at);
  const center = [cx, cy];
  const shape = (points) =>
    inset(points, corner + gap / 2).map(([x, y]) => [fmt(x), fmt(y)]);
  return {
    stroke: fmt(corner * 2),
    top: shape([top, upperRight, center, upperLeft]),
    left: shape([upperLeft, center, bottom, lowerLeft]),
    right: shape([center, upperRight, lowerRight, bottom]),
  };
}

// At favicon sizes the gap has to be proportionally wider to stay visible.
const SMALL = { corner: 0.07, gap: 0.19 };
const tuned = (spec, small) =>
  small
    ? { ...spec, corner: spec.r * SMALL.corner, gap: spec.r * SMALL.gap }
    : spec;

const pathD = (points) => `M${points.map((p) => p.join(' ')).join('L')}Z`;
const facetSvg = (f, [top, left, right]) =>
  [
    ['top', top],
    ['left', left],
    ['right', right],
  ]
    .map(
      ([k, fill]) =>
        `<path d="${pathD(f[k])}" fill="${fill}" stroke="${fill}" stroke-width="${f.stroke}" stroke-linejoin="round"/>`
    )
    .join('');

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${title ? `<title>${title}</title>` : ''}${body}</svg>\n`;

const ON_TILE = [C.paper, C.mint, C.ink];
const ON_LIGHT = [C.mint, C.green, C.ink];
const ON_DARK = [C.paper, C.mint, C.green];

// ---------- Mark variants (512 canvas unless noted) ----------

const mark = {
  tile: (small = false) =>
    svg(
      512,
      512,
      `<rect width="512" height="512" rx="112" fill="${C.green}"/>${facetSvg(facets(tuned({ cx: 256, cy: 256, r: small ? 214 : 204 }, small)), ON_TILE)}`,
      'WillieCubed'
    ),
  square: (r = 204, colors = ON_TILE, bg = C.green) =>
    svg(
      512,
      512,
      `${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ''}${facetSvg(facets({ cx: 256, cy: 256, r }), colors)}`,
      'WillieCubed'
    ),
  // The bare cube, cropped to its drawn edge like components/brand/Mark.tsx,
  // so the file's box is the cube's box.
  cube: (colors, small = false) => {
    const box = cubeBounds(facets(tuned({ cx: 0, cy: 0, r: 250 }, small)));
    return svg(
      ceil2(box.x2 - box.x1),
      ceil2(box.y2 - box.y1),
      facetSvg(
        facets(tuned({ cx: -box.x1, cy: -box.y1, r: 250 }, small)),
        colors
      ),
      'WillieCubed'
    );
  },
};

// ---------- Text ----------

// The drawn box of a cube: its facet corners plus half the round stroke.
function cubeBounds(f) {
  const points = [...f.top, ...f.left, ...f.right];
  const half = f.stroke / 2;
  return {
    x1: Math.min(...points.map((p) => p[0])) - half,
    x2: Math.max(...points.map((p) => p[0])) + half,
    y1: Math.min(...points.map((p) => p[1])) - half,
    y2: Math.max(...points.map((p) => p[1])) + half,
  };
}

const CAP_HEIGHT = BOLD.tables.os2.sCapHeight / BOLD.unitsPerEm;

// The bare cube on the lockup's own background, with the label beside it.
// The tile belongs only to the mark shown alone.
//
// Both labels are measured by cap height, even the all-lowercase
// "williecubed", so both lockups follow one rule. The cube's drawn box is
// CUBE_SCALE times the cap height, and it sits optically on the baseline
// rather than centred beside the text: its bottom point hangs DROP of its
// own height below the baseline, so the two lower side faces rest on the
// baseline like the letters' stems and the point dips below it the way a
// round letter overshoots. That puts the cube's centre on the middle of the
// cap band. The gap from the cube to the first letter is GAP of the cube's
// height.
const CAP_PX = 120;
const CUBE_SCALE = 1.5;
const DROP = 0.14;
const GAP = 0.25;

// ---------- Usage rules ----------

// Every rule on willie.page/brand and in guidelines.json comes from here.
// Clear space is one unit, x: the lockup's cube-to-name gap, so x is a
// quarter of the cube's drawn height in every file. At or below
// SMALL_MAX_PX, each mark switches to its -small cut with wider gaps.
// Minimum sizes measure the file's height, which the trimmed artwork makes
// the drawing's height too.
const CLEAR_SPACE = GAP;
const SMALL_MAX_PX = 48;
const MIN_SIZE = {
  tile: { px: 16, mm: 5 },
  cube: { px: 16, mm: 5 },
  lockup: { px: 24, mm: 6 },
  wordmark: { px: 16, mm: 4 },
};
// Rounds a drawn edge outward, so trimming never clips the artwork.
const ceil2 = (n) => Math.ceil(n * 100 - 1e-6) / 100;

function lockup({ label, color }) {
  const size = CAP_PX / CAP_HEIGHT;
  const cubeHeight = CUBE_SCALE * CAP_PX;
  // Every facet measure scales with r, so one measurement sizes the cube.
  const probe = cubeBounds(facets({ cx: 0, cy: 0, r: 100 }));
  const scale = cubeHeight / (probe.y2 - probe.y1);
  const text = BOLD.getPath(label, 0, 0, size).getBoundingBox();
  // Lay out around the baseline at y = 0, then drop everything by the
  // tallest ink (the cube's top, i-dots or ascenders). The artboard ends
  // where the drawing does; clear space is the user's to leave.
  const cubeTop = DROP * cubeHeight - cubeHeight;
  const baseline = -Math.min(cubeTop, text.y1);
  const cube = facets({
    cx: -probe.x1 * scale,
    cy: baseline + cubeTop - probe.y1 * scale,
    r: 100 * scale,
  });
  const box = cubeBounds(cube);
  const textX = box.x2 + GAP * cubeHeight - text.x1;
  const glyphs = BOLD.getPath(label, textX, baseline, size);
  const ink = glyphs.getBoundingBox();
  const width = ceil2(Math.max(ink.x2, box.x2));
  const height = ceil2(Math.max(box.y2, ink.y2));
  return {
    svg: svg(
      width,
      height,
      `${facetSvg(cube, color === C.ink ? ON_LIGHT : ON_DARK)}<path d="${glyphs.toPathData(2)}" fill="${color}"/>`,
      label
    ),
    cube: box,
    cap: CAP_PX,
  };
}

const WORDMARK_PX = 96;

function wordmark(color) {
  const size = WORDMARK_PX;
  const p = BOLD.getPath('williecubed', 0, 0, size);
  const box = p.getBoundingBox();
  const width = ceil2(box.x2 - box.x1);
  const height = ceil2(box.y2 - box.y1);
  const d = BOLD.getPath('williecubed', -box.x1, -box.y1, size).toPathData(2);
  return {
    svg: svg(width, height, `<path d="${d}" fill="${color}"/>`, 'williecubed'),
    cap: WORDMARK_PX * CAP_HEIGHT,
  };
}

function ogImage() {
  const w = 1200;
  const h = 630;
  const name = BOLD.getPath('Willie Chalmers III', 96, 360, 76).toPathData(2);
  const line1 = BOLD.getPath(
    'builds software and systems',
    96,
    450,
    52
  ).toPathData(2);
  const line2 = BOLD.getPath('for people.', 96, 516, 52).toPathData(2);
  const url = BOLD.getPath('willie.page', 96, 150, 34).toPathData(2);
  const markBox = `<rect x="936" y="96" width="168" height="168" rx="${(168 * 112) / 512}" fill="${C.green}"/>${facetSvg(facets({ cx: 1020, cy: 180, r: 168 * (204 / 512) }), ON_TILE)}`;
  return svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${C.paper}"/>${markBox}<path d="${url}" fill="${C.green}"/><path d="${name}" fill="${C.ink}"/><path d="${line1}" fill="${C.muted}"/><path d="${line2}" fill="${C.muted}"/>`,
    'Willie Chalmers III'
  );
}

// ---------- Writers ----------

const files = [];
function write(rel, data, meta = {}) {
  const abs = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
  files.push({ rel, bytes: fs.statSync(abs).size, ...meta });
  return abs;
}
// Marks are sized by height, the dimension their minimum sizes measure; a
// trimmed cube is taller than it is wide.
const png = (svgText, value, mode = 'width') =>
  new Resvg(svgText, {
    fitTo: { mode, value },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();

function pdf(rel, svgText) {
  const [, w, h] = svgText
    .match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/)
    .map(Number);
  const doc = new PDFDocument({
    size: [w, h],
    margin: 0,
    info: {
      Title: 'WillieCubed',
      Author: 'Willie Chalmers III',
      CreationDate: BUILD_EPOCH,
      ModDate: BUILD_EPOCH,
    },
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', resolve));
  SVGtoPDF(doc, svgText, 0, 0, { width: w, height: h });
  doc.end();
  return done.then(() => write(rel, Buffer.concat(chunks)));
}

// ICO entries may hold PNG data; every browser and Windows since Vista reads it.
function ico(sizes, source) {
  const images = sizes.map((s) => png(source(s), s));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], e);
    header.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(img.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  return Buffer.concat([header, ...images]);
}

// ---------- Build ----------

fs.rmSync(OUT, { recursive: true, force: true });
const pending = [];

// Mark
const BLACK = ['#000000', '#000000', '#000000'];
const WHITE = ['#ffffff', '#ffffff', '#ffffff'];
// kind picks the clear-space and minimum-size rules; background is where
// the file belongs; small draws the cut with wider gaps for 48px and under.
const MARKS = {
  'williecubed-mark': {
    svg: mark.tile(),
    small: mark.tile(true),
    kind: 'tile',
    background: 'any',
    label: 'The cube',
    note: 'Default. Use wherever the mark stands alone.',
  },
  'williecubed-mark-square': {
    svg: mark.square(),
    kind: 'square',
    background: 'any',
    label: 'Full-bleed square',
    note: 'For platforms that apply their own mask, like app stores and avatars.',
  },
  'williecubed-cube-on-light': {
    svg: mark.cube(ON_LIGHT),
    small: mark.cube(ON_LIGHT, true),
    kind: 'cube',
    background: 'light',
    label: 'Cube on light',
    note: 'For light backgrounds without the tile.',
  },
  'williecubed-cube-on-dark': {
    svg: mark.cube(ON_DARK),
    small: mark.cube(ON_DARK, true),
    kind: 'cube',
    background: 'dark',
    label: 'Cube on dark',
    note: 'For dark backgrounds without the tile.',
    dark: true,
  },
  'williecubed-cube-black': {
    svg: mark.cube(BLACK),
    small: mark.cube(BLACK, true),
    kind: 'cube',
    background: 'light',
    label: 'One color, black',
    note: 'For single-color printing and embossing.',
  },
  'williecubed-cube-white': {
    svg: mark.cube(WHITE),
    small: mark.cube(WHITE, true),
    kind: 'cube',
    background: 'dark',
    label: 'One color, white',
    note: 'For single-color use on dark or photographic backgrounds.',
    dark: true,
  },
};
const MARK_PNG = [256, 512, 1024, 2048];
const SMALL_PNG = [16, 32, 48, 96];
for (const [name, m] of Object.entries(MARKS)) {
  write(`mark/${name}.svg`, m.svg, { group: 'mark', variant: name });
  pending.push(pdf(`mark/${name}.pdf`, m.svg));
  for (const size of MARK_PNG)
    write(`mark/png/${name}-${size}.png`, png(m.svg, size, 'height'), {
      group: 'mark-png',
      variant: name,
      size,
    });
  if (!m.small) continue;
  write(`mark/${name}-small.svg`, m.small, { group: 'mark', variant: name });
  pending.push(pdf(`mark/${name}-small.pdf`, m.small));
  for (const size of SMALL_PNG)
    write(`mark/png/${name}-small-${size}.png`, png(m.small, size, 'height'), {
      group: 'mark-png',
      variant: name,
      size,
    });
}

// Lockups and wordmark
const WORDMARK_NOTE = 'The name alone, for when the cube is already nearby.';
const HANDLE_NOTE = 'For projects I make as WillieCubed.';
const NAME_NOTE = 'For introducing me to people who might not know the cube.';
const LOCKUPS = {
  'williecubed-wordmark-ink': {
    ...wordmark(C.ink),
    kind: 'wordmark',
    note: WORDMARK_NOTE,
  },
  'williecubed-wordmark-paper': {
    ...wordmark(C.paper),
    kind: 'wordmark',
    note: WORDMARK_NOTE,
  },
  'williecubed-lockup-ink': {
    ...lockup({ label: 'williecubed', color: C.ink }),
    kind: 'lockup',
    note: HANDLE_NOTE,
  },
  'williecubed-lockup-paper': {
    ...lockup({ label: 'williecubed', color: C.paper }),
    kind: 'lockup',
    note: HANDLE_NOTE,
  },
  'willie-chalmers-iii-lockup-ink': {
    ...lockup({ label: 'Willie Chalmers III', color: C.ink }),
    kind: 'lockup',
    note: NAME_NOTE,
  },
  'willie-chalmers-iii-lockup-paper': {
    ...lockup({ label: 'Willie Chalmers III', color: C.paper }),
    kind: 'lockup',
    note: NAME_NOTE,
  },
};
const lockupLabel = (name) =>
  `${name
    .replace(/-(ink|paper)$/, '')
    .replace('williecubed-wordmark', 'Wordmark')
    .replace('williecubed-lockup', 'williecubed lockup')
    .replace(
      'willie-chalmers-iii-lockup',
      'Name lockup'
    )}, ${name.endsWith('paper') ? 'on dark' : 'on light'}`;
for (const [name, l] of Object.entries(LOCKUPS)) {
  write(`lockups/${name}.svg`, l.svg, { group: 'lockup', variant: name });
  pending.push(pdf(`lockups/${name}.pdf`, l.svg));
  const w = Number(l.svg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/)[1]);
  write(`lockups/png/${name}@2x.png`, png(l.svg, Math.round(w * 2)), {
    group: 'lockup-png',
    variant: name,
  });
}

// The page magnifies the regular tile at 16px beside its small cut, to show
// why the switch exists. These stay out of the kit.
write('guide/williecubed-mark-16.png', png(mark.tile(), 16), {
  group: 'guide',
});

// Web and PWA
const favicon = mark.tile(true);
write('web/favicon.svg', favicon, {
  group: 'web',
  purpose: 'SVG favicon for modern browsers',
});
write(
  'web/favicon.ico',
  ico([16, 32, 48], (s) => mark.tile(s <= SMALL_MAX_PX)),
  { group: 'web', purpose: 'ICO favicon with 16, 32, and 48px images' }
);
write('web/apple-touch-icon.png', png(mark.square(), 180), {
  group: 'web',
  purpose: 'Home screen icon for iPhone and iPad (180px, full bleed)',
});
for (const s of [48, 72, 96, 144, 192, 512])
  write(`web/icon-${s}.png`, png(mark.tile(s <= SMALL_MAX_PX), s), {
    group: 'web',
    purpose: `Manifest icon, ${s}px`,
  });
// Maskable icons keep the cube inside the central 80% safe circle.
for (const s of [192, 512])
  write(`web/icon-maskable-${s}.png`, png(mark.square(150), s), {
    group: 'web',
    purpose: `Maskable manifest icon, ${s}px`,
  });
write(
  'web/icon-monochrome.svg',
  mark.square(150, ['#000000', '#000000', '#000000'], null),
  { group: 'web', purpose: 'Monochrome manifest icon for themed launchers' }
);
write(
  'web/icon-monochrome-512.png',
  png(mark.square(150, ['#000000', '#000000', '#000000'], null), 512),
  { group: 'web', purpose: 'Monochrome manifest icon, 512px' }
);

const manifest = {
  id: '/',
  name: 'Willie Chalmers III',
  short_name: 'WillieCubed',
  description: 'Willie Chalmers III builds software and systems for people.',
  lang: 'en-US',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  categories: ['productivity'],
  background_color: C.paper,
  theme_color: C.green,
  icons: [
    {
      src: '/brand/web/favicon.svg',
      type: 'image/svg+xml',
      sizes: 'any',
      purpose: 'any',
    },
    ...[48, 72, 96, 144, 192, 512].map((s) => ({
      src: `/brand/web/icon-${s}.png`,
      type: 'image/png',
      sizes: `${s}x${s}`,
      purpose: 'any',
    })),
    ...[192, 512].map((s) => ({
      src: `/brand/web/icon-maskable-${s}.png`,
      type: 'image/png',
      sizes: `${s}x${s}`,
      purpose: 'maskable',
    })),
    {
      src: '/brand/web/icon-monochrome-512.png',
      type: 'image/png',
      sizes: '512x512',
      purpose: 'monochrome',
    },
  ],
};
write('web/manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n', {
  group: 'web',
  purpose: 'Web app manifest',
});

// Social
write('social/og-image.png', png(ogImage(), 1200), {
  group: 'social',
  purpose: 'Link preview image for Open Graph and X (1200×630)',
});
write('social/og-image.svg', ogImage(), {
  group: 'social',
  purpose: 'Link preview image, vector source',
});
for (const s of [400, 1024])
  write(`social/avatar-${s}.png`, png(mark.square(190), s), {
    group: 'social',
    purpose: `Profile picture, safe for circular crops (${s}px)`,
  });

// Apple platforms. An Icon Composer document is the source for iOS, iPadOS,
// macOS, watchOS, and visionOS 26 and later; Xcode's actool renders its
// Liquid Glass appearances. The flat asset catalog serves older Xcode versions,
// which require an opaque full-bleed square.
const flatIcon = mark.square();
write('apple/AppIcon.appiconset/icon-1024.png', png(flatIcon, 1024), {
  group: 'apple',
  purpose: 'Flat app icon for Xcode 16 and earlier',
});
write(
  'apple/AppIcon.appiconset/Contents.json',
  JSON.stringify(
    {
      images: [
        {
          filename: 'icon-1024.png',
          idiom: 'universal',
          platform: 'ios',
          size: '1024x1024',
        },
        {
          filename: 'icon-1024.png',
          idiom: 'universal',
          platform: 'watchos',
          size: '1024x1024',
        },
      ],
      info: { author: 'xcode', version: 1 },
    },
    null,
    2
  ) + '\n',
  { group: 'apple', purpose: 'Xcode asset catalog for the flat icon' }
);

const LAYER = 1024;
const layerFacets = facets({ cx: 512, cy: 512, r: 420 });
const layerSvg = (points, fill, title) =>
  svg(
    LAYER,
    LAYER,
    `<path d="${pathD(points)}" fill="${fill}" stroke="${fill}" stroke-width="${layerFacets.stroke}" stroke-linejoin="round"/>`,
    title
  );
const srgb = (hex) =>
  `srgb:${[1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(5)).join(',')},1.00000`;
const iconDocument = {
  'fill-specializations': [
    { value: { solid: srgb(C.green) } },
    { appearance: 'dark', value: { solid: srgb(C.ink) } },
  ],
  groups: [
    {
      name: 'Cube',
      layers: [
        { name: 'Top', 'image-name': 'facet-top.svg', glass: true },
        { name: 'Left', 'image-name': 'facet-left.svg', glass: true },
        // Ink vanishes against the dark background, so this facet turns green in dark mode.
        {
          name: 'Right',
          'image-name': 'facet-right.svg',
          glass: true,
          'fill-specializations': [
            { appearance: 'dark', value: { solid: srgb(C.green) } },
          ],
        },
      ],
      lighting: 'combined',
      shadow: { kind: 'neutral', opacity: 0.5 },
      translucency: { enabled: true, value: 0.4 },
    },
  ],
  'supported-platforms': { circles: ['watchOS'], squares: 'shared' },
};
write(
  'apple/WillieCubed.icon/icon.json',
  JSON.stringify(iconDocument, null, 2) + '\n',
  {
    group: 'apple',
    purpose: 'Icon Composer document with Liquid Glass layers (Xcode 26)',
  }
);
write(
  'apple/WillieCubed.icon/Assets/facet-top.svg',
  layerSvg(layerFacets.top, C.paper, 'Top facet')
);
write(
  'apple/WillieCubed.icon/Assets/facet-left.svg',
  layerSvg(layerFacets.left, C.mint, 'Left facet')
);
write(
  'apple/WillieCubed.icon/Assets/facet-right.svg',
  layerSvg(layerFacets.right, C.ink, 'Right facet')
);

const glassRenders = [];
function renderLiquidGlass() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'williecubed-icon-'));
  const extractor = path.join(work, 'extract-renders');
  execFileSync(
    'xcrun',
    [
      'swiftc',
      '-O',
      path.join(HERE, 'apple/extract-renders.swift'),
      '-o',
      extractor,
    ],
    { stdio: 'ignore' }
  );
  const document = path.join(OUT, 'apple/WillieCubed.icon');
  for (const [platform, label, target, devices] of [
    ['iphoneos', 'ios', '17.0', ['iphone']],
    ['macosx', 'macos', '14.0', []],
  ]) {
    const compiled = path.join(work, label);
    const extracted = path.join(work, `${label}-renders`);
    fs.mkdirSync(compiled);
    fs.mkdirSync(extracted);
    execFileSync(
      'xcrun',
      [
        'actool',
        document,
        '--compile',
        compiled,
        '--platform',
        platform,
        ...devices.flatMap((d) => ['--target-device', d]),
        '--minimum-deployment-target',
        target,
        '--app-icon',
        'WillieCubed',
        '--output-partial-info-plist',
        path.join(compiled, 'partial.plist'),
      ],
      { stdio: 'ignore' }
    );
    execFileSync(extractor, [path.join(compiled, 'Assets.car'), extracted], {
      stdio: 'ignore',
    });
    const largest = fs
      .readdirSync(extracted)
      .filter((f) => f.startsWith('WillieCubed-'))
      .sort(
        (a, b) => parseInt(b.split('-').at(-1)) - parseInt(a.split('-').at(-1))
      );
    const pick = (test) =>
      largest.find((f) => test(f.split('-').slice(1, -1).join('-')));
    const appearances = {
      default: pick((a) => !/dark|tint/i.test(a)),
      dark: pick((a) => /dark/i.test(a)),
      tinted: pick((a) => /tint/i.test(a)),
    };
    for (const [appearance, file] of Object.entries(appearances)) {
      if (!file) continue;
      const rel = `apple/liquid-glass/williecubed-${label}-${appearance}.png`;
      write(rel, fs.readFileSync(path.join(extracted, file)), {
        group: 'apple',
        purpose: `${label === 'ios' ? 'iOS and iPadOS' : 'macOS'} ${appearance} appearance, rendered by actool`,
      });
      glassRenders.push({ rel, label, appearance });
    }
    if (label === 'macos' && appearances.default) {
      // ICNS for distribution outside Xcode, resized from the Liquid Glass render.
      const iconset = path.join(work, 'WillieCubed.iconset');
      fs.mkdirSync(iconset);
      const source = path.join(extracted, appearances.default);
      for (const base of [16, 32, 128, 256, 512]) {
        for (const [suffix, px] of [
          ['', base],
          ['@2x', base * 2],
        ])
          execFileSync(
            'sips',
            [
              '-z',
              String(px),
              String(px),
              source,
              '--out',
              path.join(iconset, `icon_${base}x${base}${suffix}.png`),
            ],
            { stdio: 'ignore' }
          );
      }
      const icns = path.join(OUT, 'apple/macos/WillieCubed.icns');
      fs.mkdirSync(path.dirname(icns), { recursive: true });
      execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icns]);
      files.push({
        rel: 'apple/macos/WillieCubed.icns',
        bytes: fs.statSync(icns).size,
        group: 'apple',
        purpose: 'macOS app icon with Liquid Glass (ICNS, 16 to 1024px)',
      });
    }
  }
  fs.rmSync(work, { recursive: true, force: true });
}
try {
  renderLiquidGlass();
} catch (error) {
  console.warn(
    `Skipped Liquid Glass renders; they need Xcode 26 on macOS (${error.message.split('\n')[0]})`
  );
}

// Android adaptive icons: 108dp layers with the cube inside the 66dp safe zone.
const dp = facets({ cx: 54, cy: 54, r: 30 });
const vectorPath = (points, fill) =>
  `    <path android:pathData="${pathD(points)}" android:fillColor="${fill}" android:strokeColor="${fill}" android:strokeWidth="${dp.stroke}" android:strokeLineJoin="round"/>`;
const vector = (body) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="108dp" android:height="108dp"\n    android:viewportWidth="108" android:viewportHeight="108">\n${body}\n</vector>\n`;
const argb = (hex) => `#FF${hex.slice(1).toUpperCase()}`;
write(
  'android/res/drawable/ic_launcher_background.xml',
  vector(
    `    <path android:pathData="M0,0h108v108h-108z" android:fillColor="${argb(C.green)}"/>`
  ),
  { group: 'android', purpose: 'Adaptive icon background layer' }
);
write(
  'android/res/drawable/ic_launcher_foreground.xml',
  vector(
    [
      vectorPath(dp.top, argb(C.paper)),
      vectorPath(dp.left, argb(C.mint)),
      vectorPath(dp.right, argb(C.ink)),
    ].join('\n')
  ),
  { group: 'android', purpose: 'Adaptive icon foreground layer' }
);
write(
  'android/res/drawable/ic_launcher_monochrome.xml',
  vector(
    [dp.top, dp.left, dp.right]
      .map((p) => vectorPath(p, '#FF000000'))
      .join('\n')
  ),
  { group: 'android', purpose: 'Themed icon layer (Android 13 and later)' }
);
const adaptive = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@drawable/ic_launcher_background"/>\n    <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>\n</adaptive-icon>\n`;
write('android/res/mipmap-anydpi-v26/ic_launcher.xml', adaptive, {
  group: 'android',
  purpose: 'Adaptive icon definition (API 26 and later)',
});
for (const [density, s] of [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
]) {
  write(
    `android/res/mipmap-${density}/ic_launcher.png`,
    png(mark.tile(s <= SMALL_MAX_PX), s),
    { group: 'android', purpose: `Legacy launcher icon, ${density} (${s}px)` }
  );
}
write('android/play-store-512.png', png(mark.square(186), 512), {
  group: 'android',
  purpose: 'Google Play store listing icon (512px, full bleed)',
});

// Design tokens in the W3C Design Tokens Community Group format.
const tokens = {
  $description: 'WillieCubed brand tokens',
  color: Object.fromEntries(
    Object.entries(COLOR).map(([k, v]) => [
      k,
      { $type: 'color', $value: v.hex, $description: v.role },
    ])
  ),
  font: {
    display: {
      $type: 'fontFamily',
      $value: ['Atkinson Hyperlegible Next', 'system-ui', 'sans-serif'],
    },
    mono: {
      $type: 'fontFamily',
      $value: ['Atkinson Hyperlegible Mono', 'ui-monospace', 'monospace'],
    },
  },
  typography: Object.fromEntries(
    typeScale.map((role) => [
      role.name,
      {
        $type: 'typography',
        $description: role.use,
        $value: {
          fontFamily: '{font.display}',
          fontSize: { value: role.size, unit: 'px' },
          fontWeight: role.weight,
          letterSpacing: {
            value: Number(
              (parseFloat(role.letterSpacing) * role.size).toFixed(3)
            ),
            unit: 'px',
          },
          lineHeight: role.lineHeight / role.size,
        },
      },
    ])
  ),
};
write(
  'tokens/williecubed.tokens.json',
  JSON.stringify(tokens, null, 2) + '\n',
  { group: 'tokens', purpose: 'Design tokens (W3C DTCG format)' }
);
write(
  'tokens/williecubed.css',
  `:root {\n${Object.entries(COLOR)
    .map(([k, v]) => `  --wc-${k}: ${v.hex};`)
    .join(
      '\n'
    )}\n  --wc-font-display: 'Atkinson Hyperlegible Next', system-ui, sans-serif;\n  --wc-font-mono: 'Atkinson Hyperlegible Mono', ui-monospace, monospace;\n${typeScale
    .map(
      (role) =>
        `  --wc-text-${role.name}: ${role.size}px;\n  --wc-text-${role.name}--line-height: ${role.lineHeight}px;\n  --wc-text-${role.name}--font-weight: ${role.weight};\n  --wc-text-${role.name}--letter-spacing: ${role.letterSpacing};\n  --wc-text-${role.name}--font-family: var(--wc-font-display);`
    )
    .join('\n')}\n}\n`,
  { group: 'tokens', purpose: 'CSS custom properties' }
);

await Promise.all(pending);

// Root copies live where browsers and crawlers look for them by convention.
fs.copyFileSync(
  path.join(OUT, 'web/favicon.ico'),
  path.join(PUBLIC, 'favicon.ico')
);
fs.copyFileSync(
  path.join(OUT, 'web/favicon.svg'),
  path.join(PUBLIC, 'icon.svg')
);
fs.copyFileSync(
  path.join(OUT, 'web/apple-touch-icon.png'),
  path.join(PUBLIC, 'apple-touch-icon.png')
);
// The site serves its own manifest from app/manifest.ts, with colors from
// lib/theme; web/manifest.webmanifest stays in the kit only.

// ---------- Usage rules for people and agents ----------

// The rules below render on /brand from kit.json and ship as
// guidelines.json and guidelines.md, so a person reading the page and an
// agent reading the kit follow the same numbers.
const SITE = 'https://willie.page';
const siteUrl = (rel) => `${SITE}/brand/${rel}`;
const viewBox = (s) =>
  s
    .match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/)
    .slice(1)
    .map(Number);
const ratio = (n) => Number(n.toFixed(3));
const rect = ({ x1, y1, x2, y2 }) => ({
  x: fmt(x1),
  y: fmt(y1),
  width: fmt(x2 - x1),
  height: fmt(y2 - y1),
});

// x in the file's own units, and as a share of its width and height.
function clearSpace(x, width, height) {
  return { x: fmt(x), ofWidth: ratio(x / width), ofHeight: ratio(x / height) };
}

function markUsage(m) {
  const [width, height] = viewBox(m.svg);
  const base = { kind: m.kind, background: m.background, width, height };
  // The platform crops this one, so it has no placement rules of its own.
  if (m.kind === 'square') return { ...base, platformOnly: true };
  // A trimmed cube file is its cube; the tile holds one at radius 204.
  const cube =
    m.kind === 'tile'
      ? cubeBounds(facets({ cx: 256, cy: 256, r: 204 }))
      : { x1: 0, y1: 0, x2: width, y2: height };
  return {
    ...base,
    cube: rect(cube),
    clearSpace: clearSpace(CLEAR_SPACE * (cube.y2 - cube.y1), width, height),
    minSize: MIN_SIZE[m.kind],
  };
}

function lockupUsage(name, l) {
  const [width, height] = viewBox(l.svg);
  // The wordmark takes the x of a lockup set at the same cap height.
  const cubeHeight = l.cube ? l.cube.y2 - l.cube.y1 : CUBE_SCALE * l.cap;
  return {
    kind: l.kind,
    background: name.endsWith('paper') ? 'dark' : 'light',
    width,
    height,
    ...(l.cube && { cube: rect(l.cube) }),
    clearSpace: clearSpace(CLEAR_SPACE * cubeHeight, width, height),
    minSize: MIN_SIZE[l.kind],
  };
}

const SELECTION = [
  {
    when: 'A platform asks for an app icon, favicon, avatar, or link preview',
    use: [],
    note: 'Use the platform files in web/, apple/, android/, and social/. They follow each platform’s template, so leave their artwork as it is.',
  },
  {
    when: 'Introducing me to people who might not know the cube',
    use: ['willie-chalmers-iii-lockup-ink', 'willie-chalmers-iii-lockup-paper'],
  },
  {
    when: 'Crediting a project I make as WillieCubed',
    use: ['williecubed-lockup-ink', 'williecubed-lockup-paper'],
  },
  {
    when: 'Naming WillieCubed where the cube is already nearby',
    use: ['williecubed-wordmark-ink', 'williecubed-wordmark-paper'],
  },
  {
    when: 'Showing the cube on its own',
    use: ['williecubed-mark'],
  },
  {
    when: 'Placing the cube where the tile would clash with the background',
    use: ['williecubed-cube-on-light', 'williecubed-cube-on-dark'],
  },
  {
    when: 'Printing in one ink, embossing, or placing it on a photo',
    use: ['williecubed-cube-black', 'williecubed-cube-white'],
  },
  {
    when: `Showing a mark at ${SMALL_MAX_PX}px tall or smaller`,
    use: [],
    note: 'Use that file’s small version, whose name ends in -small. Its wider gaps keep the faces apart. Lockups and the wordmark have no small version, so keep them at or above their minimum size.',
  },
];

// The ids match the examples on /brand.
const PROHIBITED = [
  {
    id: 'rotate',
    rule: 'Don’t rotate or tilt the logo.',
    why: 'The cube’s angles are what make it read as a cube.',
  },
  {
    id: 'stretch',
    rule: 'Don’t stretch, squash, or skew it.',
    why: 'Scale it evenly, from a corner.',
  },
  {
    id: 'recolor',
    rule: 'Don’t recolor the faces or change their order.',
    why: 'Use a one-color version when you need a single color.',
  },
  {
    id: 'effects',
    rule: 'Don’t add shadows, glows, outlines, gradients, or bevels.',
    why: 'The logo is flat on purpose.',
  },
  {
    id: 'crowd',
    rule: 'Don’t put text or other graphics inside the clear space.',
    why: 'Leave x clear on every side.',
  },
  {
    id: 'too-small',
    rule: `Don’t use a regular version at ${SMALL_MAX_PX}px or smaller.`,
    why: 'Its gaps close up. Use its small version instead.',
  },
  {
    id: 'rebuild',
    rule: 'Don’t redraw the cube, rearrange a lockup, or set my name in another typeface.',
    why: 'Use the files as they are.',
  },
];

const EXCEPTIONS = [
  'Platform icon files in web/, apple/, android/, and social/ follow each platform’s own template. Clear space and minimum sizes apply to the logo files in mark/ and lockups/.',
];

const ENTRIES = {
  ...Object.fromEntries(
    Object.entries(MARKS).map(([name, m]) => [
      name,
      { label: m.label, note: m.note, usage: markUsage(m) },
    ])
  ),
  ...Object.fromEntries(
    Object.entries(LOCKUPS).map(([name, l]) => [
      name,
      { label: lockupLabel(name), note: l.note, usage: lockupUsage(name, l) },
    ])
  ),
};
const choices = (names) =>
  names.map((name) => ({
    name,
    label: ENTRIES[name].label,
    background: ENTRIES[name].usage.background,
  }));
const selection = SELECTION.map((s) => ({ ...s, use: choices(s.use) }));
const markFiles = (base, sizes) => ({
  svg: siteUrl(`mark/${base}.svg`),
  pdf: siteUrl(`mark/${base}.pdf`),
  png: Object.fromEntries(
    sizes.map((s) => [s, siteUrl(`mark/png/${base}-${s}.png`)])
  ),
});
const CLEAR_SPACE_RULE = `x is ${CLEAR_SPACE * 100}% of the cube’s drawn height. It is the same space that separates the cube from the name in every lockup. Every file ends where its drawing ends, so leave x clear outside the file’s edge on all four sides.`;
const SMALL_RULE = `At ${SMALL_MAX_PX}px tall or smaller, use a mark’s -small version, whose gaps are wider so the faces stay apart. Above ${SMALL_MAX_PX}px, use the regular version.`;

const guidelines = {
  name: 'WillieCubed brand guidelines',
  owner: 'Willie Chalmers III',
  source: `${SITE}/brand`,
  kit: siteUrl('williecubed-brand.zip'),
  tokens: siteUrl('tokens/williecubed.tokens.json'),
  clearSpace: { unit: 'x', ratio: CLEAR_SPACE, rule: CLEAR_SPACE_RULE },
  minimumSize: {
    measure: 'height',
    rule: 'Minimum sizes measure the file’s height: pixels on screen, millimeters in print.',
  },
  smallVersions: { maxPx: SMALL_MAX_PX, rule: SMALL_RULE },
  selection,
  prohibited: PROHIBITED,
  exceptions: EXCEPTIONS,
  files: Object.entries(ENTRIES).map(([name, e]) => {
    const { cube, ...usage } = e.usage;
    const m = MARKS[name];
    return {
      name,
      label: e.label,
      use: e.note,
      ...usage,
      files: m
        ? markFiles(name, MARK_PNG)
        : {
            svg: siteUrl(`lockups/${name}.svg`),
            pdf: siteUrl(`lockups/${name}.pdf`),
            png: { '2x': siteUrl(`lockups/png/${name}@2x.png`) },
          },
      ...(m?.small && { small: markFiles(`${name}-small`, SMALL_PNG) }),
    };
  }),
  colors: Object.fromEntries(
    Object.entries(COLOR).map(([k, v]) => [
      k,
      { name: v.name, hex: v.hex, role: v.role },
    ])
  ),
  fonts: {
    display: 'Atkinson Hyperlegible Next',
    mono: 'Atkinson Hyperlegible Mono',
  },
};

const percent = (n) => `${Math.round(n * 1000) / 10}%`;
const placeable = guidelines.files.filter((f) => !f.platformOnly);
const guidelinesMd = [
  `# ${guidelines.name}`,
  `The rules for using ${guidelines.owner}’s WillieCubed logo. The page is ${guidelines.source}; the same rules as JSON are at ${siteUrl('guidelines.json')}, and every file is in ${guidelines.kit}.`,
  '## Clear space',
  CLEAR_SPACE_RULE,
  '| File | x, as a share of the file’s width | x, as a share of its height |\n| --- | --- | --- |\n' +
    placeable
      .map(
        (f) =>
          `| ${f.label} (\`${f.name}\`) | ${percent(f.clearSpace.ofWidth)} | ${percent(f.clearSpace.ofHeight)} |`
      )
      .join('\n'),
  '## Minimum size',
  `${guidelines.minimumSize.rule} ${SMALL_RULE}`,
  '| File | Smallest on screen | Smallest in print | Small version |\n| --- | --- | --- | --- |\n' +
    placeable
      .map(
        (f) =>
          `| ${f.label} | ${f.minSize.px}px | ${f.minSize.mm}mm | ${f.small ? `\`${f.name}-small\`, up to ${SMALL_MAX_PX}px` : 'None'} |`
      )
      .join('\n'),
  '## Choosing a version',
  selection
    .map(
      (s, i) =>
        `${i + 1}. ${s.when}: ${
          s.use.length
            ? `${s.use
                .map(
                  (u) =>
                    `${u.label} (\`${u.name}\`, ${u.background} backgrounds)`
                )
                .join(' or ')}.`
            : s.note
        }`
    )
    .join('\n'),
  '## What to avoid',
  PROHIBITED.map((p) => `- ${p.rule} ${p.why}`).join('\n'),
  '## Exceptions',
  EXCEPTIONS.map((e) => `- ${e}`).join('\n'),
  '## Files',
  '| File | Use | Background | SVG | Small SVG |\n| --- | --- | --- | --- | --- |\n' +
    guidelines.files
      .map(
        (f) =>
          `| ${f.label} | ${f.use} | ${f.background} | ${f.files.svg} | ${f.small?.svg ?? 'None'} |`
      )
      .join('\n'),
  '## Colors',
  '| Color | Hex | Role |\n| --- | --- | --- |\n' +
    Object.values(guidelines.colors)
      .map((c) => `| ${c.name} | \`${c.hex}\` | ${c.role} |`)
      .join('\n'),
  '## Type',
  `${guidelines.fonts.display} for my name and longer text; ${guidelines.fonts.mono} for labels, captions, and code.`,
].join('\n\n');

write('guidelines.json', JSON.stringify(guidelines, null, 2) + '\n', {
  group: 'guidelines',
});
write(
  'guidelines.md',
  await prettier.format(guidelinesMd, { parser: 'markdown' }),
  { group: 'guidelines' }
);

// Everything in one archive.
for (const f of fs.readdirSync(OUT, { recursive: true }))
  fs.utimesSync(path.join(OUT, f), BUILD_EPOCH, BUILD_EPOCH);
execFileSync(
  'zip',
  [
    '-qrX',
    'williecubed-brand.zip',
    'mark',
    'lockups',
    'web',
    'social',
    'apple',
    'android',
    'tokens',
    'guidelines.json',
    'guidelines.md',
    '-x',
    '*.DS_Store',
  ],
  { cwd: OUT }
);
const zipBytes = fs.statSync(path.join(OUT, 'williecubed-brand.zip')).size;

// ---------- Manifest for /brand ----------

// app/brand/page.tsx renders the download page from this list, inside the
// site's own layout, so every label, note, and size it shows comes from the
// files written above.
function oklch(hex) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) =>
    lin(parseInt(hex.slice(i, i + 2), 16) / 255)
  );
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return `oklch(${(L * 100).toFixed(1)}% ${Math.hypot(A, B).toFixed(3)} ${((h + 360) % 360).toFixed(1)})`;
}
const rgb = (hex) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')})`;

const href = (rel) => `/brand/${rel}`;
const download = (rel, label) => ({
  label,
  href: href(rel),
  bytes: fs.statSync(path.join(OUT, rel)).size,
});
const fileList = (group) =>
  files
    .filter((f) => f.group === group)
    .map((f) => ({
      name: f.rel
        .split('/')
        .slice(1)
        .join('/')
        .replace(/^res\//, ''),
      href: href(f.rel),
      bytes: f.bytes,
      purpose: f.purpose ?? '',
    }));

const kit = {
  archive: download('williecubed-brand.zip', 'Download brand kit'),
  marks: Object.entries(MARKS).map(([name, m]) => ({
    name,
    label: m.label,
    note: m.note,
    dark: Boolean(m.dark),
    preview: href(`mark/${name}.svg`),
    downloads: [
      download(`mark/${name}.svg`, 'SVG'),
      download(`mark/${name}.pdf`, 'PDF'),
      ...[512, 1024, 2048].map((s) =>
        download(`mark/png/${name}-${s}.png`, `PNG ${s}`)
      ),
    ],
    ...(m.small && {
      small: {
        preview: href(`mark/${name}-small.svg`),
        downloads: [
          download(`mark/${name}-small.svg`, 'SVG'),
          download(`mark/${name}-small.pdf`, 'PDF'),
          ...SMALL_PNG.map((s) =>
            download(`mark/png/${name}-small-${s}.png`, `PNG ${s}`)
          ),
        ],
      },
    }),
    usage: ENTRIES[name].usage,
  })),
  lockups: Object.entries(LOCKUPS).map(([name, l]) => {
    const [width, height] = viewBox(l.svg);
    return {
      name,
      label: lockupLabel(name),
      note: l.note,
      dark: name.endsWith('paper'),
      preview: href(`lockups/${name}.svg`),
      width,
      height,
      // The label's cap height in the SVG's own units, so the page can show
      // every lockup at one cap height however wide it is.
      cap: fmt(l.cap),
      downloads: [
        download(`lockups/${name}.svg`, 'SVG'),
        download(`lockups/${name}.pdf`, 'PDF'),
        download(`lockups/png/${name}@2x.png`, 'PNG'),
      ],
      usage: ENTRIES[name].usage,
    };
  }),
  usage: {
    clearSpace: CLEAR_SPACE,
    smallMaxPx: SMALL_MAX_PX,
    selection,
    prohibited: PROHIBITED,
    exceptions: EXCEPTIONS,
    guide: { regular16: href('guide/williecubed-mark-16.png') },
    guidelines: [
      download('guidelines.json', 'guidelines.json'),
      download('guidelines.md', 'guidelines.md'),
    ],
  },
  colors: Object.entries(COLOR).map(([key, v]) => ({
    key,
    name: v.name,
    role: v.role,
    hex: v.hex,
    rgb: rgb(v.hex),
    oklch: oklch(v.hex),
  })),
  tokens: [
    download('tokens/williecubed.tokens.json', 'Design tokens (DTCG JSON)'),
    download('tokens/williecubed.css', 'CSS custom properties'),
  ],
  appIcons: glassRenders
    .filter((r) => r.label === 'ios')
    .map((r) => ({
      appearance: r.appearance,
      preview: href(r.rel),
      downloads: [download(r.rel, 'PNG 1024')],
    })),
  platforms: [
    ['Web and PWA', 'web'],
    ['Apple platforms', 'apple'],
    ['Android', 'android'],
    ['Social', 'social'],
  ].map(([title, group]) => ({ title, files: fileList(group) })),
};

const KIT = path.join(HERE, '..', 'lib/brand/kit.json');
fs.writeFileSync(
  KIT,
  await prettier.format(JSON.stringify(kit), {
    ...(await prettier.resolveConfig(KIT)),
    filepath: KIT,
  })
);
console.log(
  `Wrote ${files.length} files to public/brand (archive ${(zipBytes / 1048576).toFixed(1)} MB) and lib/brand/kit.json.`
);
