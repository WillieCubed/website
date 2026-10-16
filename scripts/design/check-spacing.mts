import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import exceptions from './spacing-exceptions.json' with { type: 'json' };
import { inspectSpacingTokens } from './spacing-tokens.mts';
import { type SpacingFinding, scanFile } from './spacing-values.mts';

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
const findings = [
  ...sources.flatMap(({ file, source }) => scanFile(file, source)),
  ...tokens.hidden,
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
if (violations.length || stale.length || tokens.missing.length) {
  console.error(
    `${violations.length} unexplained off-grid spacing declarations; ${stale.length} stale exceptions; ${tokens.missing.length} undefined spacing tokens.`
  );
  process.exitCode = 1;
} else {
  console.log(
    `Spacing check passed: ${exceptions.length} documented optical/accessibility exceptions; no unexplained fixed spacing.`
  );
}
