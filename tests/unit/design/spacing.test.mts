import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectSpacingTokens } from '../../../scripts/design/spacing-tokens.mts';
import {
  offGridLengths,
  scanClasses,
  scanCss,
  scanTypeScript,
} from '../../../scripts/design/spacing-values.mts';

test('fixed spacing is checked inside shorthands and responsive calculations', () => {
  assert.deepEqual(offGridLengths('6px 1.125rem calc(100% - 12px)'), [6, 18]);
  assert.deepEqual(offGridLengths('clamp(24px, 3vw, 32px)'), []);
  assert.deepEqual(
    scanCss(
      'fixture.css',
      '.card { padding: 14px 16px; gap: 8px; border: 1px solid; font-size: 15px; translate: 0 10px; }'
    ).map((entry) => entry.property),
    ['padding']
  );
});

test('spacing tokens and negative spacing cannot bypass the source check', () => {
  const entries = scanCss(
    'fixture.css',
    ':root { --panel-edge: 10px; --sheet-gap: 10; --text-body--letter-spacing: 0.01em; } .card { margin: -6px; }'
  );
  assert.deepEqual(
    entries.map((entry) => entry.property),
    ['--panel-edge', '--sheet-gap', 'margin']
  );
});

test('fractional Tailwind utilities and arbitrary spacing values are checked', () => {
  const entries = scanClasses(
    'fixture.tsx',
    'md:gap-1.5 px-2 py-2.5 mt-[14px] -mx-[6px] rounded-[14px] border'
  );
  assert.deepEqual(
    entries.map((entry) => entry.value),
    ['6px', '10px', '14px', '6px']
  );
});

test('SVG drawing commands are not mistaken for spacing utility classes', () => {
  assert.deepEqual(scanClasses('fixture.tsx', '10.7l6.6-3.4m-6.6'), []);
});

test('pixel utilities and arbitrary properties cannot bypass the spacing grid', () => {
  assert.deepEqual(
    scanClasses(
      'fixture.tsx',
      'p-px md:[padding:6px] [margin-left:10px] [border-width:1px]'
    ).map((entry) => entry.value),
    ['1px', '6px', '10px']
  );
});

test('off-grid spacing is found through aliases across different stylesheets', () => {
  const result = inspectSpacingTokens([
    { file: 'tokens.css', source: ':root { --a: 6px; --b: var(--a); }' },
    {
      file: 'card.css',
      source: '.card { padding: var(--b); gap: var(--spacing-missing); }',
    },
  ]);
  assert.deepEqual(
    result.hidden.map((entry) => entry.property),
    ['--a']
  );
  assert.deepEqual(result.missing, [
    { file: 'card.css', name: '--spacing-missing' },
  ]);
});

test('inline React styles and CSS inside interpolated HTML remain covered', () => {
  const source =
    'const x = <div style={{ gap: 18, padding: "6px 8px" }} className="gap-0.5" />; const html = `<style>:root { color: ${color}; } .card { margin-top: 10px; }</style>`;';
  const entries = scanTypeScript('fixture.tsx', source);
  assert.equal(entries.length, 4);
  assert.ok(entries.some((entry) => entry.selector === '.card'));
});
