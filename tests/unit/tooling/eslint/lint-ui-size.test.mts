import { ESLint } from 'eslint';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// These syntax-only cases use virtual UI modules, without a TypeScript project.
const eslint = new ESLint({
  overrideConfig: {
    languageOptions: { parserOptions: { projectService: false } },
    rules: { '@typescript-eslint/strict-boolean-expressions': 'off' },
  },
});

async function findings(
  code: string,
  filePath = 'components/music/SizeProbe.tsx'
) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map(({ ruleId, severity }) => ({ ruleId, severity }));
}

test('large branch-free JSX produces a size error', async () => {
  const code = `export function LargePanel() {
    return <section>
      ${Array.from({ length: 151 }, () => '<p>Playlist</p>').join('\n')}
    </section>;
  }`;
  assert.deepEqual(await findings(code), [
    { ruleId: 'max-lines-per-function', severity: 2 },
  ]);
});

test('many straight-line hook operations produce a statement error', async () => {
  const code = `export function useBusyHook() {
    ${Array.from({ length: 31 }, (_, i) => `Number(${i});`).join('\n')}
  }`;
  assert.deepEqual(await findings(code), [
    { ruleId: 'max-statements', severity: 2 },
  ]);
});

test('an oversized effect is rejected even when its parent hook is small', async () => {
  const code = `export function useBusyHook() {
    useEffect(() => {
      ${Array.from({ length: 31 }, (_, i) => `Number(${i});`).join('\n')}
    }, []);
  }`;
  assert.deepEqual(await findings(code), [
    { ruleId: 'max-statements', severity: 2 },
  ]);
});

test('comments and blank lines do not pressure readable code into extraction', async () => {
  const code = `export function Panel() {
    ${Array.from({ length: 160 }, () => '// Explain the behavior.\n').join('\n')}
    return <p>Playlist</p>;
  }`;
  assert.deepEqual(await findings(code), []);
});

test('UI size heuristics leave library and test workflows outside the review scope', async () => {
  const code = `export function workflow() {
    ${Array.from({ length: 151 }, (_, i) => `Number(${i});`).join('\n')}
  }`;
  for (const filePath of ['lib/music/workflow.ts', 'tests/example.test.mts']) {
    assert.deepEqual(await findings(code, filePath), []);
  }
});
