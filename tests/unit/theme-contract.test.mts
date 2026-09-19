import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import { plainPage } from '@/lib/plain-page';
import { site } from '@/lib/site';
import { THEME_TRANSITION_DURATION_MS } from '@/lib/theme-transition';

const projectRoot = process.cwd();
const rawPalette =
  /\b(?:bg|text|border|divide|ring|outline|fill|stroke)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/\d+)?\b/g;
const darkColorFork =
  /\bdark:(?:bg|text|border|divide|ring|outline|fill|stroke)-[^\s'"]+/g;
const colorLiteral = /#[\da-fA-F]{3,8}\b/g;

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(target);
      return /\.(?:css|ts|tsx)$/.test(entry.name) ? [target] : [];
    })
  );
  return files.flat();
}

test('site components use semantic color tokens without dark color forks', async () => {
  const files = (
    await Promise.all(
      ['app', 'components', 'lib/writings'].map((directory) =>
        sourceFiles(path.join(projectRoot, directory))
      )
    )
  )
    .flat()
    .filter((file) => !file.endsWith('app/globals.css'));

  const violations: string[] = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const pattern of [rawPalette, darkColorFork, colorLiteral]) {
      for (const match of source.matchAll(pattern)) {
        const line = source.slice(0, match.index).split('\n').length;
        violations.push(
          `${path.relative(projectRoot, file)}:${line} ${match[0]}`
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('the root theme owns light, dark, animated, and reduced-motion states', async () => {
  const [css, layout, transition] = await Promise.all([
    readFile(path.join(projectRoot, 'app/globals.css'), 'utf8'),
    readFile(path.join(projectRoot, 'app/layout.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'lib/theme-transition.ts'), 'utf8'),
  ]);

  assert.match(css, /color-scheme:\s*light dark/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /\[data-theme-transition\]/);
  assert.match(css, /transition-property:[^;}]*background-color/s);
  assert.match(
    css,
    new RegExp(`--duration-theme:\\s*${THEME_TRANSITION_DURATION_MS}ms`)
  );
  assert.doesNotMatch(css, /@property --color-/);
  assert.match(layout, /themeTransitionScript/);
  assert.match(layout, /<script/);
  assert.match(layout, /dangerouslySetInnerHTML/);
  assert.match(transition, /prefers-color-scheme: dark/);
  assert.match(transition, /prefers-reduced-motion: reduce/);
  assert.match(transition, /themeTransition/);
});

test('site identity publishes a browser chrome color for each scheme', () => {
  const colors = (
    site as unknown as {
      themeColors?: { light: string; dark: string };
    }
  ).themeColors;

  assert.deepEqual(colors, { light: '#f4f5ef', dark: '#111413' });
});

test('venture roles carry one Material color for each scheme', () => {
  const style = schemeStyleFromHex('#2f6f5e');

  assert.match(
    style['--b-primary'],
    /^light-dark\(#[\da-f]{6}, #[\da-f]{6}\)$/
  );
  assert.notEqual(
    style['--b-primary'].slice(11, 18),
    style['--b-primary'].slice(20, 27)
  );
});

test('standalone browser pages follow the system scheme', async () => {
  const response = plainPage(
    new Request(`${site.origin}/tea`, { headers: { Accept: 'text/html' } }),
    { title: 'Tea', lines: ['Ready.'] }
  );
  const html = await response.text();

  assert.match(html, /color-scheme:light dark/);
  assert.match(html, /@media\(prefers-color-scheme:dark\)/);
  assert.match(html, /var\(--color-surface\)/);
  assert.match(html, /var\(--color-on-surface\)/);
});
