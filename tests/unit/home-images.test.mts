import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { type Picture, products, ventures } from '@/lib/home/ventures';

const PUBLIC = join(import.meta.dirname, '../../public');
const HOME = join(PUBLIC, 'assets/home');

/** The largest a homepage picture may be before it needs another pass. */
const BUDGET = 100 * 1024;

/** Reads a WebP file's canvas size from its first chunk. */
function webpSize(file: Buffer): { width: number; height: number } {
  assert.equal(file.toString('ascii', 0, 4), 'RIFF');
  assert.equal(file.toString('ascii', 8, 12), 'WEBP');
  const chunk = file.toString('ascii', 12, 16);
  switch (chunk) {
    case 'VP8 ':
      return {
        width: file.readUInt16LE(26) & 0x3fff,
        height: file.readUInt16LE(28) & 0x3fff,
      };
    case 'VP8L': {
      const bits = file.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    case 'VP8X':
      return {
        width: file.readUIntLE(24, 3) + 1,
        height: file.readUIntLE(27, 3) + 1,
      };
    default:
      throw new Error(`Unknown WebP chunk ${chunk}`);
  }
}

/** Every sized picture the homepage data points at, found by shape. */
function pictures(value: unknown, found = new Map<string, Picture>()) {
  if (Array.isArray(value)) {
    for (const item of value) pictures(item, found);
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.src === 'string' && record.src.startsWith('/assets/')) {
      found.set(record.src, {
        src: record.src,
        width: record.width as number,
        height: record.height as number,
      });
    }
    for (const child of Object.values(record)) pictures(child, found);
  }
  return found;
}

const all = [...pictures([ventures, products]).values()];

test('the homepage data points at pictures', () => {
  assert.ok(all.length > 0);
});

for (const picture of all) {
  test(`${picture.src} is a WebP file of the size the data gives`, () => {
    assert.match(picture.src, /\.webp$/);
    const file = readFileSync(join(PUBLIC, picture.src));
    assert.deepEqual(webpSize(file), {
      width: picture.width,
      height: picture.height,
    });
  });
}

test('every homepage asset is WebP and within budget', () => {
  for (const name of readdirSync(HOME)) {
    assert.match(name, /\.webp$/, `${name} should be converted to WebP`);
    const size = statSync(join(HOME, name)).size;
    assert.ok(size <= BUDGET, `${name} is ${size} bytes`);
  }
});
