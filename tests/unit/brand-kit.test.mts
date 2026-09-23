import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
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
