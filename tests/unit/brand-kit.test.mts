import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  IOS_ICON_RADIUS,
  formatBytes,
  iosIconMask,
  iosIconPath,
  kit,
  kitHrefs,
} from '@/lib/brand/kit';

const PUBLIC = join(import.meta.dirname, '../../public');

test('every file /brand links to is in public/brand at the size it prints', () => {
  const files = kitHrefs();
  assert.ok(files.length > 80, `only ${files.length} files`);
  for (const file of files) {
    assert.match(file.href, /^\/brand\/[^?#]+$/, file.href);
    const stat = statSync(join(PUBLIC, file.href));
    assert.ok(stat.isFile(), file.href);
    assert.equal(stat.size, file.bytes, `${file.href} changed size`);
  }
});

test('every preview on /brand is in public/brand', () => {
  const previews = [
    ...kit.marks.map((mark) => mark.preview),
    ...kit.lockups.map((lockup) => lockup.preview),
    ...kit.appIcons.map((icon) => icon.preview),
  ];
  for (const href of previews) {
    assert.ok(statSync(join(PUBLIC, href)).isFile(), href);
  }
});

test('the page is not also a static file that would shadow the route', () => {
  assert.throws(() => statSync(join(PUBLIC, 'brand/index.html')));
});

test('lockups carry what the page needs to show them at one cap height', () => {
  for (const lockup of kit.lockups) {
    assert.ok(lockup.cap > 0 && lockup.cap < lockup.height, lockup.name);
    assert.ok(lockup.width > lockup.height, lockup.name);
  }
});

const logos = [...kit.marks, ...kit.lockups];
const read = (href: string) => readFileSync(join(PUBLIC, href), 'utf8');
const viewBox = (svg: string) =>
  svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);

test('every logo but the platform square carries its placement rules', () => {
  for (const logo of logos) {
    const { usage } = logo;
    if (usage.platformOnly) {
      assert.equal(usage.kind, 'square', logo.name);
      continue;
    }
    assert.ok(usage.clearSpace && usage.clearSpace.x > 0, logo.name);
    assert.ok(usage.minSize && usage.minSize.px >= 16, logo.name);
    assert.ok(usage.minSize.mm > 0, logo.name);
  }
});

test('x is one share of the cube’s height in every file', () => {
  for (const { name, usage } of logos) {
    if (!usage.cube || !usage.clearSpace) continue;
    const expected = kit.usage.clearSpace * usage.cube.height;
    assert.ok(
      Math.abs(usage.clearSpace.x - expected) < 0.01,
      `${name}: x ${usage.clearSpace.x}, expected ${expected}`
    );
  }
});

test('logo files end where their drawing ends', () => {
  for (const { name, preview, usage } of logos) {
    const [x, y, width, height] = viewBox(read(preview));
    assert.deepEqual([x, y], [0, 0], name);
    assert.equal(width, usage.width, name);
    assert.equal(height, usage.height, name);
    // A cube-only file is its cube; a lockup's cube sets its height.
    if (usage.kind === 'cube' || usage.kind === 'lockup') {
      assert.ok(usage.cube, name);
      assert.ok(Math.abs(usage.cube.x) < 0.02, `${name} starts at its cube`);
      assert.ok(Math.abs(usage.cube.y) < 0.02, `${name} tops out at its cube`);
      assert.ok(usage.height - usage.cube.height < 0.02, name);
    }
  }
});

test('a lockup’s cube-to-name gap is its clear space', () => {
  for (const { name, preview, usage } of kit.lockups) {
    if (usage.kind !== 'lockup' || !usage.cube || !usage.clearSpace) continue;
    // The name is the one path without a stroke; its pairs are x, y.
    const d = read(preview).match(/<path d="([^"]+)" fill="[^"]+"\/>/)![1];
    const numbers = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const left = Math.min(...numbers.filter((_, i) => i % 2 === 0));
    const gap = left - (usage.cube.x + usage.cube.width);
    assert.ok(
      Math.abs(gap - usage.clearSpace.x) < 0.1,
      `${name}: gap ${gap}, x ${usage.clearSpace.x}`
    );
  }
});

test('marks switch to a small cut, and the favicon is the tile’s', () => {
  for (const mark of kit.marks) {
    if (mark.usage.kind === 'square') continue;
    assert.ok(mark.small, `${mark.name} has no small version`);
    assert.ok(statSync(join(PUBLIC, mark.small.preview)).isFile());
  }
  const tile = kit.marks.find((mark) => mark.name === 'williecubed-mark');
  assert.equal(read('/brand/web/favicon.svg'), read(tile!.small!.preview));
});

test('guidelines.json points only at files the kit ships', () => {
  const guidelines = JSON.parse(read('/brand/guidelines.json'));
  const urls = JSON.stringify(guidelines).match(
    /https:\/\/willie\.page\/brand\/[^"]+/g
  )!;
  assert.ok(urls.length > 60, `only ${urls.length} URLs`);
  for (const url of urls) {
    const href = url.replace('https://willie.page', '');
    assert.ok(statSync(join(PUBLIC, href)).isFile(), href);
  }
  const names = new Set(logos.map((logo) => logo.name));
  for (const choice of guidelines.selection)
    for (const use of choice.use) assert.ok(names.has(use.name), use.name);
  assert.equal(guidelines.clearSpace.ratio, kit.usage.clearSpace);
  assert.equal(guidelines.smallVersions.maxPx, kit.usage.smallMaxPx);
});

test('guidelines.md names every logo file and every rule', () => {
  const markdown = read('/brand/guidelines.md');
  for (const logo of logos) assert.ok(markdown.includes(logo.label), logo.name);
  for (const rule of kit.usage.prohibited)
    assert.ok(markdown.includes(rule.rule), rule.id);
});

test('file sizes read the way the old page printed them', () => {
  assert.equal(formatBytes(601), '601 B');
  assert.equal(formatBytes(1858), '1.8 KB');
  assert.equal(formatBytes(35616), '35 KB');
  assert.equal(formatBytes(4670097), '4.5 MB');
});

test('the iOS icon outline closes inside the unit square', () => {
  const d = iosIconPath();
  assert.match(d, /^M[\d. ]+/);
  assert.ok(d.endsWith('Z'));
  assert.equal(d.match(/C/g)?.length, 12);
  assert.equal(d.match(/L/g)?.length, 12);
  const numbers = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  assert.ok(numbers.every((n) => n >= 0 && n <= 1));
  // It starts where the top edge leaves the top-left corner.
  const start = Number((IOS_ICON_RADIUS * 1.52866483).toFixed(5));
  assert.ok(d.startsWith(`M${start} 0`));
  // The last corner comes back round to the start.
  assert.ok(d.endsWith(`${start} 0Z`), d.slice(-40));
});

test('the mask is a data URI the stylesheet can use as is', () => {
  const mask = iosIconMask();
  assert.ok(mask.startsWith('url("data:image/svg+xml,'));
  assert.ok(mask.endsWith('")'));
  assert.ok(!mask.slice(5, -2).includes('"'));
});
