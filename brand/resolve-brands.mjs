// Reads each venture's public site and writes the brand seed it finds to
// lib/brand/seeds.json. Run `pnpm brand:seeds` after a venture rebrands.
//
// For every site the script fetches the page and takes the first saturated
// color it finds, checking in this order:
//   1. theme_color in the web manifest the page links to
//   2. the <meta name="theme-color"> tag
//   3. background colors on primary buttons in inline <style> blocks and in
//      same-origin linked stylesheets (rules whose selector mentions a
//      button, .btn, .button, or .primary)
//   4. the dominant color of the site's icon, when the icon is an SVG
//      (rendered with @resvg/resvg-js). Raster icons are skipped because
//      decoding PNG or ICO would need another dependency.
// A site that yields no saturated color keeps its previous seed and is
// reported, so the page stays neutral for it rather than turning grey.
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'lib', 'brand', 'seeds.json');

const SITES = {
  lvbt: 'https://lasvegasfortransit.org/',
  logdate: 'https://logdate.app/',
  docket: 'https://docket.hypertext.studio/',
  curfew: 'https://curfew.hypertext.studio/',
  lovelace: 'https://uselovelace.com/',
  atlas: 'https://atlas.rebuildingus.org/',
  hypertext: 'https://hypertext.studio/',
};

const USER_AGENT = 'willie.page brand resolver (+https://willie.page/)';

async function get(url, accept = 'text/html') {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res;
}

function normalizeHex(value) {
  const m = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  return `#${hex}`;
}

function rgbFromCss(value) {
  const hex = normalizeHex(value);
  if (hex) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  const m = value.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function hexFromRgb([r, g, b]) {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// A color counts as saturated when it would read as a brand color rather
// than a neutral: enough chroma, and neither near-black nor near-white.
function isSaturated([r, g, b]) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return s >= 0.35 && l >= 0.15 && l <= 0.8;
}

function firstSaturated(values) {
  for (const value of values) {
    const rgb = rgbFromCss(value);
    if (rgb && isSaturated(rgb)) return hexFromRgb(rgb);
  }
  return null;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return m ? m[1] : null;
}

function linkTags(html, rel) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => {
      const rels = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
      return rels.includes(rel);
    });
}

async function fromManifest(html, base) {
  for (const tag of linkTags(html, 'manifest')) {
    const href = attr(tag, 'href');
    if (!href) continue;
    try {
      const manifest = await (
        await get(
          new URL(href, base),
          'application/manifest+json, application/json'
        )
      ).json();
      const hex =
        manifest.theme_color && firstSaturated([manifest.theme_color]);
      if (hex) return hex;
    } catch {
      // A missing manifest just moves on to the next signal.
    }
  }
  return null;
}

function fromThemeColor(html) {
  const values = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => (attr(tag, 'name') ?? '').toLowerCase() === 'theme-color')
    .map((tag) => attr(tag, 'content'))
    .filter(Boolean);
  return firstSaturated(values);
}

function buttonColors(css) {
  const values = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1];
    if (!/button|\.btn\b|\.button|primary/i.test(selector)) continue;
    for (const decl of m[2].matchAll(
      /(?:^|;)\s*(?:background(?:-color)?|--[\w-]*primary[\w-]*)\s*:\s*([^;]+)/gi
    )) {
      values.push(decl[1]);
    }
  }
  return values;
}

async function fromButtons(html, base) {
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (m) => m[1]
  );
  const hex = firstSaturated(inline.flatMap(buttonColors));
  if (hex) return hex;
  for (const tag of linkTags(html, 'stylesheet')) {
    const href = attr(tag, 'href');
    if (!href) continue;
    const url = new URL(href, base);
    if (url.origin !== new URL(base).origin) continue;
    try {
      const css = await (await get(url, 'text/css')).text();
      const found = firstSaturated(buttonColors(css));
      if (found) return found;
    } catch {
      // Skip stylesheets that fail to load.
    }
  }
  return null;
}

// Renders the icon at 32px and picks the most common saturated pixel,
// which handles icons that are one brand color on a neutral background.
function dominantColor(svg) {
  const rendered = new Resvg(svg, {
    fitTo: { mode: 'width', value: 32 },
  }).render();
  const { pixels, width, height } = rendered;
  const counts = new Map();
  for (let i = 0; i < width * height; i++) {
    const [r, g, b, a] = [
      pixels[i * 4],
      pixels[i * 4 + 1],
      pixels[i * 4 + 2],
      pixels[i * 4 + 3],
    ];
    if (a < 128 || !isSaturated([r, g, b])) continue;
    // Quantize so anti-aliased edges vote with their neighbors.
    const key = hexFromRgb([r & 0xf0, g & 0xf0, b & 0xf0]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

async function fromIcon(html, base) {
  const tags = linkTags(html, 'icon').concat(
    linkTags(html, 'apple-touch-icon')
  );
  for (const tag of tags) {
    const href = attr(tag, 'href');
    if (!href) continue;
    const url = new URL(href, base);
    const type = (attr(tag, 'type') ?? '').toLowerCase();
    if (!(type === 'image/svg+xml' || url.pathname.endsWith('.svg'))) continue;
    try {
      const svg = await (await get(url, 'image/svg+xml')).text();
      const hex = dominantColor(svg);
      if (hex) return hex;
    } catch {
      // Skip icons that fail to load or render.
    }
  }
  return null;
}

async function resolve(url) {
  const html = await (await get(url)).text();
  const steps = [
    ['manifest', () => fromManifest(html, url)],
    ['theme-color', () => fromThemeColor(html)],
    ['buttons', () => fromButtons(html, url)],
    ['icon', () => fromIcon(html, url)],
  ];
  for (const [source, step] of steps) {
    const hex = await step();
    if (hex) return { hex, source };
  }
  return null;
}

const previous = fs.existsSync(OUT)
  ? JSON.parse(fs.readFileSync(OUT, 'utf8'))
  : {};
const seeds = {};
for (const [key, url] of Object.entries(SITES)) {
  try {
    const seed = await resolve(url);
    if (seed) {
      seeds[key] = seed;
      console.log(`${key.padEnd(10)} ${seed.hex}  (${seed.source})`);
    } else {
      seeds[key] = previous[key];
      console.warn(
        `${key.padEnd(10)} no saturated color found; kept ${previous[key]?.hex ?? 'nothing'}`
      );
    }
  } catch (error) {
    seeds[key] = previous[key];
    console.warn(
      `${key.padEnd(10)} ${error.message}; kept ${previous[key]?.hex ?? 'nothing'}`
    );
  }
}
fs.writeFileSync(OUT, `${JSON.stringify(seeds, null, 2)}\n`);
console.log(`Wrote ${path.relative(process.cwd(), OUT)}`);
