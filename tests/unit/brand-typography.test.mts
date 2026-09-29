import { typeScale } from '@/brand/type-scale.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '../..');
const siteCss = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');
const kitCss = readFileSync(
  join(ROOT, 'public/brand/tokens/williecubed.css'),
  'utf8'
);
const kitJson = JSON.parse(
  readFileSync(
    join(ROOT, 'public/brand/tokens/williecubed.tokens.json'),
    'utf8'
  )
);

const roles = [
  'display-large',
  'display-medium',
  'display-small',
  'headline-large',
  'headline-medium',
  'headline-small',
  'title-large',
  'title-medium',
  'title-small',
  'body-large',
  'body-medium',
  'body-small',
  'label-large',
  'label-medium',
  'label-small',
];

test('brand typography publishes every site role with matching values', () => {
  assert.deepEqual(
    typeScale.map((role) => role.name),
    roles
  );

  for (const role of typeScale) {
    const prefix = `--text-${role.name}`;
    const kitPrefix = `--wc-text-${role.name}`;
    const values = {
      '': `${role.size}px`,
      '--line-height': `${role.lineHeight}px`,
      '--font-weight': String(role.weight),
      '--letter-spacing': role.letterSpacing,
    };
    for (const [suffix, value] of Object.entries(values)) {
      assert.match(
        siteCss,
        new RegExp(`${prefix}${suffix}: ${value.replace('.', '\\.')};`),
        prefix + suffix
      );
      assert.match(
        kitCss,
        new RegExp(`${kitPrefix}${suffix}: ${value.replace('.', '\\.')};`),
        kitPrefix + suffix
      );
    }
    assert.match(
      kitCss,
      new RegExp(`${kitPrefix}--font-family: var\\(--wc-font-display\\);`),
      `${kitPrefix}--font-family`
    );

    const token = kitJson.typography[role.name];
    assert.equal(token.$type, 'typography');
    assert.deepEqual(token.$value.fontFamily, '{font.display}');
    assert.deepEqual(token.$value.fontSize, { value: role.size, unit: 'px' });
    assert.equal(token.$value.fontWeight, role.weight);
    assert.equal(token.$value.lineHeight, role.lineHeight / role.size);
    assert.deepEqual(token.$value.letterSpacing, {
      value: Number((parseFloat(role.letterSpacing) * role.size).toFixed(3)),
      unit: 'px',
    });
  }
});
