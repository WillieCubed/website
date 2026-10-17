import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import exceptions from './spacing-exceptions.json' with { type: 'json' };
import { inspectSpacingTokens } from './spacing-tokens.mts';
import { type SpacingFinding, scanFile } from './spacing-values.mts';
import { scanTokenEquivalents, tokenScale } from './token-equivalents.mts';

function key(entry: Omit<SpacingFinding, 'line'>): string {
  return JSON.stringify([
    entry.file,
    entry.selector,
    entry.property,
    entry.value,
  ]);
}

// Honor the repository's ignore rules so generated search bundles stay outside
// this source contract, while newly added source files are still checked.
const files = execFileSync(
  'git',
  [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    'app',
    'components',
    'lib',
    'public',
    'content',
  ],
  { encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .filter((file) => /\.(?:css|tsx?|mts|mdx|html)$/.test(file));
const sources = await Promise.all(
  files.map(async (file) => ({ file, source: await readFile(file, 'utf8') }))
);
const tokens = inspectSpacingTokens(
  sources.filter(({ file }) => file.endsWith('.css'))
);
// A raw type size or corner radius that a token already holds names the token.
const scale = tokenScale([
  await readFile('app/globals.css', 'utf8'),
  await readFile(
    createRequire(import.meta.url).resolve('tailwindcss/theme.css'),
    'utf8'
  ),
]);
const equivalents = sources
  .filter(({ file }) => file.endsWith('.css'))
  .flatMap(({ file, source }) => scanTokenEquivalents(file, source, scale));
const findings = [
  ...sources.flatMap(({ file, source }) => scanFile(file, source)),
  ...tokens.hidden,
  ...equivalents,
];
const allowed = new Set(exceptions.map(key));
const present = new Set(findings.map(key));
const violations = findings.filter((entry) => !allowed.has(key(entry)));
const stale = exceptions.filter((entry) => !present.has(key(entry)));

for (const entry of violations)
  console.error(
    `${entry.file}:${entry.line} ${entry.selector} { ${entry.property}: ${entry.value} }`
  );
for (const entry of stale)
  console.error(
    `Stale spacing exception: ${entry.file} ${entry.selector} ${entry.property}`
  );
for (const entry of tokens.missing)
  console.error(`${entry.file}: Undefined spacing token ${entry.name}`);
if (violations.length > 0 || stale.length > 0 || tokens.missing.length > 0) {
  console.error(
    `${violations.length} unexplained off-grid spacing or raw token values; ${stale.length} stale exceptions; ${tokens.missing.length} undefined spacing tokens.`
  );
  process.exitCode = 1;
} else {
  console.log(
    `Spacing check passed: ${exceptions.length} documented optical/accessibility exceptions; no unexplained fixed spacing or raw type sizes and radii that a token holds.`
  );
}
