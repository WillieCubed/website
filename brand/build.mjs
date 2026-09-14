// Generates every WillieCubed brand asset and the willie.page/brand download
// page from one geometry and one palette. Run `pnpm brand:build` after
// changing either; never edit files under public/brand by hand.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';
import opentype from 'opentype.js';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, '..', 'public');
const OUT = path.join(PUBLIC, 'brand');
const BOLD = opentype.loadSync(path.join(HERE, 'fonts/AtkinsonHyperlegibleNext-Bold.ttf'));

const COLOR = {
  green: { hex: '#2f6f5e', name: 'Accent green', role: 'The mark’s tile and the site’s accent.' },
  ink: { hex: '#1c231e', name: 'Ink', role: 'Text and the mark’s shadow facet.' },
  paper: { hex: '#f4f5ef', name: 'Paper', role: 'Page background and the mark’s top facet.' },
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
    return [[p[0] + nx * distance, p[1] + ny * distance], [q[0] + nx * distance, q[1] + ny * distance]];
  });
  return lines.map((line, i) => {
    const [[x1, y1], [x2, y2]] = lines[(i + lines.length - 1) % lines.length];
    const [[x3, y3], [x4, y4]] = line;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  });
}

const fmt = (n) => Number(n.toFixed(2));

// An isometric cube is a regular hexagon split into three rhombi meeting at
// its center. Each facet is inset by its corner radius plus half the gap, then
// stroked with round joins, which adds the radius back as rounded corners.
function facets({ cx, cy, r, corner = r * 0.097, gap = r * 0.118 }) {
  const at = (deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  const [top, upperRight, lowerRight, bottom, lowerLeft, upperLeft] = [-90, -30, 30, 90, 150, 210].map(at);
  const center = [cx, cy];
  const shape = (points) => inset(points, corner + gap / 2).map(([x, y]) => [fmt(x), fmt(y)]);
  return {
    stroke: fmt(corner * 2),
    top: shape([top, upperRight, center, upperLeft]),
    left: shape([upperLeft, center, bottom, lowerLeft]),
    right: shape([center, upperRight, lowerRight, bottom]),
  };
}

// At favicon sizes the gap has to be proportionally wider to stay visible.
const SMALL = { corner: 0.07, gap: 0.19 };
const tuned = (spec, small) => (small ? { ...spec, corner: spec.r * SMALL.corner, gap: spec.r * SMALL.gap } : spec);

const pathD = (points) => `M${points.map((p) => p.join(' ')).join('L')}Z`;
const facetSvg = (f, [top, left, right]) =>
  [['top', top], ['left', left], ['right', right]]
    .map(([k, fill]) => `<path d="${pathD(f[k])}" fill="${fill}" stroke="${fill}" stroke-width="${f.stroke}" stroke-linejoin="round"/>`)
    .join('');

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${title ? `<title>${title}</title>` : ''}${body}</svg>\n`;

const ON_TILE = [C.paper, C.mint, C.ink];
const ON_LIGHT = [C.mint, C.green, C.ink];
const ON_DARK = [C.paper, C.mint, C.green];

// ---------- Mark variants (512 canvas unless noted) ----------

const mark = {
  tile: (small = false) => svg(512, 512, `<rect width="512" height="512" rx="112" fill="${C.green}"/>${facetSvg(facets(tuned({ cx: 256, cy: 256, r: small ? 200 : 186 }, small)), ON_TILE)}`, 'WillieCubed'),
  square: (r = 186, colors = ON_TILE, bg = C.green) => svg(512, 512, `${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ''}${facetSvg(facets({ cx: 256, cy: 256, r }), colors)}`, 'WillieCubed'),
  cube: (colors, small = false) => svg(512, 512, facetSvg(facets(tuned({ cx: 256, cy: 256, r: 250 }, small)), colors), 'WillieCubed'),
};

// macOS icons sit inside Apple's 1024 grid: an 824-point rounded body with a
// soft drop shadow, leaving the outer margin for the shadow.
const macos = () =>
  svg(1024, 1024,
    `<defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000" flood-opacity="0.3"/></filter></defs>` +
      `<rect x="100" y="100" width="824" height="824" rx="185" fill="${C.green}" filter="url(#s)"/>${facetSvg(facets({ cx: 512, cy: 512, r: 300 }), ON_TILE)}`,
    'WillieCubed');

// ---------- Text ----------

function lockup({ label, color, tile = true }) {
  const markSize = 120;
  const size = 64;
  const gap = 36;
  const pad = 24;
  const baseline = pad + markSize / 2 + (size * 0.7) / 2;
  const textX = pad + markSize + gap;
  const width = Math.ceil(textX + BOLD.getAdvanceWidth(label, size) + pad);
  const height = markSize + pad * 2;
  const glyphs = BOLD.getPath(label, textX, baseline, size).toPathData(2);
  const markBody = tile
    ? `<rect x="${pad}" y="${pad}" width="${markSize}" height="${markSize}" rx="${(markSize * 112) / 512}" fill="${C.green}"/>${facetSvg(facets({ cx: pad + markSize / 2, cy: pad + markSize / 2, r: markSize * (186 / 512) }), ON_TILE)}`
    : facetSvg(facets({ cx: pad + markSize / 2, cy: pad + markSize / 2, r: markSize * 0.47 }), color === C.ink ? ON_LIGHT : ON_DARK);
  return svg(width, height, `${markBody}<path d="${glyphs}" fill="${color}"/>`, label);
}

function wordmark(color) {
  const size = 96;
  const pad = 16;
  const p = BOLD.getPath('williecubed', 0, 0, size);
  const box = p.getBoundingBox();
  const width = Math.ceil(box.x2 - box.x1 + pad * 2);
  const height = Math.ceil(box.y2 - box.y1 + pad * 2);
  const d = BOLD.getPath('williecubed', pad - box.x1, pad - box.y1, size).toPathData(2);
  return svg(width, height, `<path d="${d}" fill="${color}"/>`, 'williecubed');
}

function ogImage() {
  const w = 1200;
  const h = 630;
  const name = BOLD.getPath('Willie Chalmers III', 96, 360, 76).toPathData(2);
  const line1 = BOLD.getPath('builds software and systems', 96, 450, 52).toPathData(2);
  const line2 = BOLD.getPath('for people.', 96, 516, 52).toPathData(2);
  const url = BOLD.getPath('willie.page', 96, 150, 34).toPathData(2);
  const markBox = `<rect x="936" y="96" width="168" height="168" rx="${(168 * 112) / 512}" fill="${C.green}"/>${facetSvg(facets({ cx: 1020, cy: 180, r: 168 * (186 / 512) }), ON_TILE)}`;
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${C.paper}"/>${markBox}<path d="${url}" fill="${C.green}"/><path d="${name}" fill="${C.ink}"/><path d="${line1}" fill="${C.muted}"/><path d="${line2}" fill="${C.muted}"/>`, 'Willie Chalmers III');
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
const png = (svgText, width) => new Resvg(svgText, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } }).render().asPng();

function pdf(rel, svgText) {
  const [, w, h] = svgText.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/).map(Number);
  const doc = new PDFDocument({ size: [w, h], margin: 0, info: { Title: 'WillieCubed', Author: 'Willie Chalmers III' } });
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
const MARKS = {
  'williecubed-mark': { svg: mark.tile(), label: 'Mark', note: 'Default. Use wherever the mark stands alone.' },
  'williecubed-mark-square': { svg: mark.square(), label: 'Full-bleed square', note: 'For platforms that apply their own mask, like app stores and avatars.' },
  'williecubed-cube-on-light': { svg: mark.cube(ON_LIGHT), label: 'Cube on light', note: 'For light backgrounds without the tile.' },
  'williecubed-cube-on-dark': { svg: mark.cube(ON_DARK), label: 'Cube on dark', note: 'For dark backgrounds without the tile.', dark: true },
  'williecubed-cube-black': { svg: mark.cube(['#000000', '#000000', '#000000']), label: 'One color, black', note: 'For single-color printing and embossing.' },
  'williecubed-cube-white': { svg: mark.cube(['#ffffff', '#ffffff', '#ffffff']), label: 'One color, white', note: 'For single-color use on dark or photographic backgrounds.', dark: true },
};
for (const [name, m] of Object.entries(MARKS)) {
  write(`mark/${name}.svg`, m.svg, { group: 'mark', variant: name });
  pending.push(pdf(`mark/${name}.pdf`, m.svg));
  for (const size of [256, 512, 1024, 2048]) write(`mark/png/${name}-${size}.png`, png(m.svg, size), { group: 'mark-png', variant: name, size });
}

// Lockups and wordmark
const LOCKUPS = {
  'williecubed-wordmark-ink': wordmark(C.ink),
  'williecubed-wordmark-paper': wordmark(C.paper),
  'williecubed-lockup-ink': lockup({ label: 'williecubed', color: C.ink }),
  'williecubed-lockup-paper': lockup({ label: 'williecubed', color: C.paper }),
  'willie-chalmers-iii-lockup-ink': lockup({ label: 'Willie Chalmers III', color: C.ink }),
  'willie-chalmers-iii-lockup-paper': lockup({ label: 'Willie Chalmers III', color: C.paper }),
};
for (const [name, s] of Object.entries(LOCKUPS)) {
  write(`lockups/${name}.svg`, s, { group: 'lockup', variant: name });
  pending.push(pdf(`lockups/${name}.pdf`, s));
  const w = Number(s.match(/viewBox="0 0 (\d+)/)[1]);
  write(`lockups/png/${name}@2x.png`, png(s, w * 2), { group: 'lockup-png', variant: name });
}

// Web and PWA
const favicon = mark.tile(true);
write('web/favicon.svg', favicon, { group: 'web', purpose: 'SVG favicon for modern browsers' });
write('web/favicon.ico', ico([16, 32, 48], (s) => mark.tile(s <= 48)), { group: 'web', purpose: 'ICO favicon with 16, 32, and 48px images' });
write('web/apple-touch-icon.png', png(mark.square(), 180), { group: 'web', purpose: 'Home screen icon for iPhone and iPad (180px, full bleed)' });
for (const s of [48, 72, 96, 144, 192, 512]) write(`web/icon-${s}.png`, png(s <= 48 ? mark.tile(true) : mark.tile(), s), { group: 'web', purpose: `Manifest icon, ${s}px` });
// Maskable icons keep the cube inside the central 80% safe circle.
for (const s of [192, 512]) write(`web/icon-maskable-${s}.png`, png(mark.square(150), s), { group: 'web', purpose: `Maskable manifest icon, ${s}px` });
write('web/icon-monochrome.svg', mark.square(150, ['#000000', '#000000', '#000000'], null), { group: 'web', purpose: 'Monochrome manifest icon for themed launchers' });
write('web/icon-monochrome-512.png', png(mark.square(150, ['#000000', '#000000', '#000000'], null), 512), { group: 'web', purpose: 'Monochrome manifest icon, 512px' });

const manifest = {
  id: '/',
  name: 'Willie Chalmers III',
  short_name: 'williecubed',
  description: 'Willie Chalmers III builds software and systems for people.',
  lang: 'en-US',
  start_url: '/',
  scope: '/',
  display: 'minimal-ui',
  background_color: C.paper,
  theme_color: C.green,
  icons: [
    { src: '/brand/web/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
    ...[48, 72, 96, 144, 192, 512].map((s) => ({ src: `/brand/web/icon-${s}.png`, type: 'image/png', sizes: `${s}x${s}`, purpose: 'any' })),
    ...[192, 512].map((s) => ({ src: `/brand/web/icon-maskable-${s}.png`, type: 'image/png', sizes: `${s}x${s}`, purpose: 'maskable' })),
    { src: '/brand/web/icon-monochrome-512.png', type: 'image/png', sizes: '512x512', purpose: 'monochrome' },
  ],
};
write('web/manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n', { group: 'web', purpose: 'Web app manifest' });

// Social
write('social/og-image.png', png(ogImage(), 1200), { group: 'social', purpose: 'Link preview image for Open Graph and X (1200×630)' });
write('social/og-image.svg', ogImage(), { group: 'social', purpose: 'Link preview image, vector source' });
for (const s of [400, 1024]) write(`social/avatar-${s}.png`, png(mark.square(170), s), { group: 'social', purpose: `Profile picture, safe for circular crops (${s}px)` });

// Apple platforms
const appIcon = mark.square(186);
const appDark = mark.square(186, ON_DARK, null);
const appTinted = mark.square(186, ['#ffffff', '#b8b8b8', '#6e6e6e'], null);
write('apple/AppIcon.appiconset/icon-1024.png', png(appIcon, 1024), { group: 'apple', purpose: 'iOS, iPadOS, and watchOS app icon (default appearance)' });
write('apple/AppIcon.appiconset/icon-1024-dark.png', png(appDark, 1024), { group: 'apple', purpose: 'Dark appearance (transparent background)' });
write('apple/AppIcon.appiconset/icon-1024-tinted.png', png(appTinted, 1024), { group: 'apple', purpose: 'Tinted appearance (grayscale)' });
write('apple/AppIcon.appiconset/Contents.json', JSON.stringify({
  images: [
    { filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
    { appearances: [{ appearance: 'luminosity', value: 'dark' }], filename: 'icon-1024-dark.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
    { appearances: [{ appearance: 'luminosity', value: 'tinted' }], filename: 'icon-1024-tinted.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
    { filename: 'icon-1024.png', idiom: 'universal', platform: 'watchos', size: '1024x1024' },
  ],
  info: { author: 'xcode', version: 1 },
}, null, 2) + '\n', { group: 'apple', purpose: 'Xcode asset catalog' });

const macSvg = macos();
write('apple/macos/williecubed-macos.svg', macSvg, { group: 'apple', purpose: 'macOS icon source on Apple’s 1024 grid' });
const iconset = path.join(OUT, 'apple/macos/WillieCubed.iconset');
fs.mkdirSync(iconset, { recursive: true });
for (const base of [16, 32, 128, 256, 512]) {
  fs.writeFileSync(path.join(iconset, `icon_${base}x${base}.png`), png(macSvg, base));
  fs.writeFileSync(path.join(iconset, `icon_${base}x${base}@2x.png`), png(macSvg, base * 2));
}
try {
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(OUT, 'apple/macos/WillieCubed.icns')]);
  files.push({ rel: 'apple/macos/WillieCubed.icns', bytes: fs.statSync(path.join(OUT, 'apple/macos/WillieCubed.icns')).size, group: 'apple', purpose: 'macOS app icon (ICNS, 16 to 1024px)' });
} catch {
  console.warn('iconutil unavailable; skipped WillieCubed.icns');
}
fs.rmSync(iconset, { recursive: true, force: true });

// Icon Composer (iOS 26 and later) and visionOS build icons from separate layers.
const LAYER = 1024;
const big = facets({ cx: 512, cy: 512, r: 372 });
write('apple/icon-composer/background.svg', svg(LAYER, LAYER, `<rect width="${LAYER}" height="${LAYER}" fill="${C.green}"/>`, 'Background'), { group: 'apple', purpose: 'Icon Composer and visionOS layer: background' });
write('apple/icon-composer/facet-top.svg', svg(LAYER, LAYER, `<path d="${pathD(big.top)}" fill="${C.paper}" stroke="${C.paper}" stroke-width="${big.stroke}" stroke-linejoin="round"/>`, 'Top facet'), { group: 'apple', purpose: 'Icon Composer and visionOS layer: top facet' });
write('apple/icon-composer/facet-left.svg', svg(LAYER, LAYER, `<path d="${pathD(big.left)}" fill="${C.mint}" stroke="${C.mint}" stroke-width="${big.stroke}" stroke-linejoin="round"/>`, 'Left facet'), { group: 'apple', purpose: 'Icon Composer and visionOS layer: left facet' });
write('apple/icon-composer/facet-right.svg', svg(LAYER, LAYER, `<path d="${pathD(big.right)}" fill="${C.ink}" stroke="${C.ink}" stroke-width="${big.stroke}" stroke-linejoin="round"/>`, 'Right facet'), { group: 'apple', purpose: 'Icon Composer and visionOS layer: right facet' });

// Android adaptive icons: 108dp layers with the cube inside the 66dp safe zone.
const dp = facets({ cx: 54, cy: 54, r: 30 });
const vectorPath = (points, fill) => `    <path android:pathData="${pathD(points)}" android:fillColor="${fill}" android:strokeColor="${fill}" android:strokeWidth="${dp.stroke}" android:strokeLineJoin="round"/>`;
const vector = (body) => `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="108dp" android:height="108dp"\n    android:viewportWidth="108" android:viewportHeight="108">\n${body}\n</vector>\n`;
const argb = (hex) => `#FF${hex.slice(1).toUpperCase()}`;
write('android/res/drawable/ic_launcher_background.xml', vector(`    <path android:pathData="M0,0h108v108h-108z" android:fillColor="${argb(C.green)}"/>`), { group: 'android', purpose: 'Adaptive icon background layer' });
write('android/res/drawable/ic_launcher_foreground.xml', vector([vectorPath(dp.top, argb(C.paper)), vectorPath(dp.left, argb(C.mint)), vectorPath(dp.right, argb(C.ink))].join('\n')), { group: 'android', purpose: 'Adaptive icon foreground layer' });
write('android/res/drawable/ic_launcher_monochrome.xml', vector([dp.top, dp.left, dp.right].map((p) => vectorPath(p, '#FF000000')).join('\n')), { group: 'android', purpose: 'Themed icon layer (Android 13 and later)' });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@drawable/ic_launcher_background"/>\n    <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>\n</adaptive-icon>\n`;
write('android/res/mipmap-anydpi-v26/ic_launcher.xml', adaptive, { group: 'android', purpose: 'Adaptive icon definition (API 26 and later)' });
for (const [density, s] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  write(`android/res/mipmap-${density}/ic_launcher.png`, png(mark.tile(s <= 48), s), { group: 'android', purpose: `Legacy launcher icon, ${density} (${s}px)` });
}
write('android/play-store-512.png', png(mark.square(186), 512), { group: 'android', purpose: 'Google Play store listing icon (512px, full bleed)' });

// Design tokens in the W3C Design Tokens Community Group format.
const tokens = {
  $description: 'WillieCubed brand tokens',
  color: Object.fromEntries(Object.entries(COLOR).map(([k, v]) => [k, { $type: 'color', $value: v.hex, $description: v.role }])),
  font: {
    display: { $type: 'fontFamily', $value: ['Atkinson Hyperlegible Next', 'system-ui', 'sans-serif'] },
    mono: { $type: 'fontFamily', $value: ['Atkinson Hyperlegible Mono', 'ui-monospace', 'monospace'] },
  },
};
write('tokens/williecubed.tokens.json', JSON.stringify(tokens, null, 2) + '\n', { group: 'tokens', purpose: 'Design tokens (W3C DTCG format)' });
write('tokens/williecubed.css', `:root {\n${Object.entries(COLOR).map(([k, v]) => `  --wc-${k}: ${v.hex};`).join('\n')}\n  --wc-font-display: 'Atkinson Hyperlegible Next', system-ui, sans-serif;\n  --wc-font-mono: 'Atkinson Hyperlegible Mono', ui-monospace, monospace;\n}\n`, { group: 'tokens', purpose: 'CSS custom properties' });

await Promise.all(pending);

// Root copies live where browsers and crawlers look for them by convention.
fs.copyFileSync(path.join(OUT, 'web/favicon.ico'), path.join(PUBLIC, 'favicon.ico'));
fs.copyFileSync(path.join(OUT, 'web/favicon.svg'), path.join(PUBLIC, 'icon.svg'));
fs.copyFileSync(path.join(OUT, 'web/apple-touch-icon.png'), path.join(PUBLIC, 'apple-touch-icon.png'));
fs.copyFileSync(path.join(OUT, 'web/manifest.webmanifest'), path.join(PUBLIC, 'manifest.webmanifest'));

// Everything in one archive.
execFileSync('zip', ['-qr', 'williecubed-brand.zip', 'mark', 'lockups', 'web', 'social', 'apple', 'android', 'tokens', '-x', '*.DS_Store'], { cwd: OUT });
const zipBytes = fs.statSync(path.join(OUT, 'williecubed-brand.zip')).size;

// ---------- Download page ----------

const kb = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const size = (rel) => kb(fs.statSync(path.join(OUT, rel)).size);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function oklch(hex) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return `oklch(${(L * 100).toFixed(1)}% ${Math.hypot(A, B).toFixed(3)} ${((h + 360) % 360).toFixed(1)})`;
}
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')})`;

const link = (rel, label) => `<a href="/brand/${rel}" download>${label}<span class="size">${size(rel)}</span></a>`;
const fileRows = (group) =>
  files.filter((f) => f.group === group).map((f) => `<li><a href="/brand/${f.rel}" download><code>${esc(f.rel.split('/').slice(1).join('/').replace(/^res\//, '').replace(/^AppIcon\.appiconset\//, 'AppIcon.appiconset/'))}</code><span class="size">${kb(f.bytes)}</span></a><span class="purpose">${esc(f.purpose ?? '')}</span></li>`).join('\n');

const markCards = Object.entries(MARKS).map(([name, m]) => `
        <figure class="asset${m.dark ? ' asset-dark' : ''}">
          <div class="asset-preview"><img src="/brand/mark/${name}.svg" alt="${m.label}" width="160" height="160" /></div>
          <figcaption>
            <h3>${m.label}</h3>
            <p>${m.note}</p>
            <p class="downloads">${link(`mark/${name}.svg`, 'SVG')}${link(`mark/${name}.pdf`, 'PDF')}${[512, 1024, 2048].map((s) => link(`mark/png/${name}-${s}.png`, `PNG ${s}`)).join('')}</p>
          </figcaption>
        </figure>`).join('');

const lockupCards = Object.keys(LOCKUPS).map((name) => {
  const dark = name.endsWith('paper');
  const label = name.replace(/-(ink|paper)$/, '').replace('williecubed-wordmark', 'Wordmark').replace('williecubed-lockup', 'williecubed lockup').replace('willie-chalmers-iii-lockup', 'Name lockup');
  return `
        <figure class="asset asset-wide${dark ? ' asset-dark' : ''}">
          <div class="asset-preview"><img src="/brand/lockups/${name}.svg" alt="${label}" /></div>
          <figcaption>
            <h3>${label}, ${dark ? 'on dark' : 'on light'}</h3>
            <p class="downloads">${link(`lockups/${name}.svg`, 'SVG')}${link(`lockups/${name}.pdf`, 'PDF')}${link(`lockups/png/${name}@2x.png`, 'PNG')}</p>
          </figcaption>
        </figure>`;
}).join('');

const swatches = Object.entries(COLOR).map(([key, v]) => `
        <li class="swatch">
          <span class="chip chip-${key}"></span>
          <h3>${v.name}</h3>
          <p>${v.role}</p>
          <dl><dt>Hex</dt><dd><code>${v.hex}</code></dd><dt>RGB</dt><dd><code>${rgb(v.hex)}</code></dd><dt>OKLCH</dt><dd><code>${oklch(v.hex)}</code></dd></dl>
        </li>`).join('');

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Brand · Willie Chalmers III</title>
    <meta name="description" content="Download the WillieCubed mark, lockups, app icons, and color and type tokens." />
    <link rel="canonical" href="https://willie.page/brand/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Willie Chalmers III" />
    <meta property="og:title" content="WillieCubed brand" />
    <meta property="og:description" content="Download the WillieCubed mark, lockups, app icons, and color and type tokens." />
    <meta property="og:url" content="https://willie.page/brand/" />
    <meta property="og:image" content="https://willie.page/brand/social/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Willie Chalmers III builds software and systems for people." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="${C.paper}" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400;500&amp;family=Atkinson+Hyperlegible+Next:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/assets/site.css" />
  </head>
  <body class="brand">
    <header class="brand-header">
      <a href="/" class="brand-home">Willie Chalmers III</a>
    </header>
    <main class="brand-main">
      <section class="brand-intro" aria-labelledby="brand-title">
        <img src="/brand/mark/williecubed-mark.svg" alt="" width="96" height="96" />
        <div>
          <h1 id="brand-title">WillieCubed brand</h1>
          <p>The mark is an isometric cube: one object with several faces. Every file here is generated from the same geometry and palette.</p>
          <p class="downloads">${link('williecubed-brand.zip', 'Download everything')}</p>
        </div>
      </section>

      <section aria-labelledby="mark">
        <h2 id="mark">Mark</h2>
        <div class="asset-grid">${markCards}
        </div>
      </section>

      <section aria-labelledby="lockups">
        <h2 id="lockups">Wordmark and lockups</h2>
        <div class="asset-grid asset-grid-wide">${lockupCards}
        </div>
      </section>

      <section aria-labelledby="color">
        <h2 id="color">Color</h2>
        <ul class="swatches">${swatches}
        </ul>
        <p class="downloads">${link('tokens/williecubed.tokens.json', 'Design tokens (DTCG JSON)')}${link('tokens/williecubed.css', 'CSS custom properties')}</p>
      </section>

      <section aria-labelledby="type">
        <h2 id="type">Typography</h2>
        <div class="type-specimens">
          <div class="specimen"><p class="specimen-sample">Atkinson Hyperlegible Next</p><p>Headlines, body text, and the wordmark. Designed by the Braille Institute for legibility.</p><p class="downloads"><a href="https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next">Google Fonts</a></p></div>
          <div class="specimen"><p class="specimen-sample specimen-mono">Atkinson Hyperlegible Mono</p><p>Labels, captions, and code.</p><p class="downloads"><a href="https://fonts.google.com/specimen/Atkinson+Hyperlegible+Mono">Google Fonts</a></p></div>
        </div>
      </section>

      <section aria-labelledby="platforms">
        <h2 id="platforms">Platform icons</h2>
        <div class="file-groups">
          <div><h3>Web and PWA</h3><ul class="files">${fileRows('web')}</ul></div>
          <div><h3>Apple platforms</h3><ul class="files">${fileRows('apple')}</ul></div>
          <div><h3>Android</h3><ul class="files">${fileRows('android')}</ul></div>
          <div><h3>Social</h3><ul class="files">${fileRows('social')}</ul></div>
        </div>
      </section>

      <section aria-labelledby="usage">
        <h2 id="usage">Usage</h2>
        <ul class="usage">
          <li>Keep clear space around the mark equal to one facet gap at the size you use it.</li>
          <li>Use the tiled mark below 32px; the facet gaps are widened for small sizes.</li>
          <li>Don’t recolor, rotate, stretch, or add effects to the cube.</li>
          <li>Use the one-color versions only where color reproduction isn’t available.</li>
        </ul>
      </section>
    </main>
  </body>
</html>
`;
write('index.html', page);
console.log(`Wrote ${files.length} files to public/brand (archive ${kb(zipBytes)}).`);
