import { ESLint } from 'eslint';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const filename = 'lib/example/value.ts';
// Comment parsing uses virtual files and does not need a TypeScript project.
const eslint = new ESLint({
  overrideConfig: {
    languageOptions: { parserOptions: { projectService: false } },
    rules: { '@typescript-eslint/strict-boolean-expressions': 'off' },
  },
});

test('code documentation rejects filenames while allowing symbol links and runtime paths', async () => {
  const [result] = await eslint.lintText(
    `import value from './value.ts';
const path = 'content/writings/hello.mdx';
/** Use {@link value}; see lib/example/value.ts. */
export { value, path };`,
    { filePath: filename }
  );
  const findings = result.messages.filter(
    (message) => message.ruleId === 'site/no-file-references'
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 3);
});

test('stylesheet documentation is checked without treating CSS URLs as comments', async () => {
  const [result] = await eslint.lintText(
    `body { background: url('/images/hero.png'); }
/* Keep this aligned with components/site/site.css. */`,
    { filePath: 'components/site/example.css' }
  );
  assert.deepEqual(
    result.messages.map(({ ruleId, line }) => ({ ruleId, line })),
    [{ ruleId: 'site/no-file-references', line: 2 }]
  );
});

test('shell and environment documentation is checked without changing executable text', async () => {
  for (const filePath of ['scripts/example.sh', 'tests/unit/example.env']) {
    const [result] = await eslint.lintText(
      '# Read docs/testing.md first.\nVALUE="content/file.json"\n',
      { filePath }
    );
    assert.deepEqual(
      result.messages.map(({ ruleId, line }) => ({ ruleId, line })),
      [{ ruleId: 'site/no-file-references', line: 1 }]
    );
  }
});

test('technology names and symbol documentation remain valid', async () => {
  const [result] = await eslint.lintText(
    '/** Next.js uses {@link value}; node.js runs it. {@link Response.json} parses the response. */\nexport const value = 1;',
    { filePath: filename }
  );
  assert.deepEqual(result.messages, []);
});

test('templated filenames, assets, dotfiles and file links are rejected', async () => {
  for (const reference of [
    'content/projects/<slug>.mdx',
    'web/manifest.webmanifest',
    '.env.local',
    'Dockerfile',
    '{@link ./module.ts}',
    '{@link value | see docs/testing.md}',
  ]) {
    const [result] = await eslint.lintText(
      `/** ${reference} */\nexport const value = 1;`,
      { filePath: filename }
    );
    assert.equal(
      result.messages.filter((m) => m.ruleId === 'site/no-file-references')
        .length,
      1,
      reference
    );
  }
});

test('shell literals and heredoc bodies are not documentation comments', async () => {
  const [result] = await eslint.lintText(
    `#!/bin/sh
VALUE='first line
# content/file.json
last line'
cat <<'DATA'
# docs/example.md
DATA
echo "$VALUE" # See docs/testing.md
`,
    { filePath: 'scripts/example.sh' }
  );
  assert.deepEqual(
    result.messages.map(({ ruleId, line, column }) => ({
      ruleId,
      line,
      column,
    })),
    [{ ruleId: 'site/no-file-references', line: 8, column: 21 }]
  );
});

test('TSDoc links to bare filenames are not mistaken for symbols', async () => {
  const [result] = await eslint.lintText(
    '/** See {@link module.ts}. */\nexport const value = 1;',
    { filePath: filename }
  );
  assert.equal(
    result.messages.filter((m) => m.ruleId === 'site/no-file-references')
      .length,
    1
  );
});

test('JSX comments are checked and comment-like runtime strings are left alone', async () => {
  const [result] = await eslint.lintText(
    `export const value = '/* filename.ts */';
export const View = () => <span>{/* See docs/testing.md. */}{value}</span>;`,
    { filePath: 'components/example/View.tsx' }
  );
  assert.deepEqual(
    result.messages.map(({ ruleId, line }) => ({ ruleId, line })),
    [{ ruleId: 'site/no-file-references', line: 2 }]
  );
});

test('extensionless source locations are rejected while public routes remain valid', async () => {
  const [result] = await eslint.lintText(
    '/** Load from lib/search; navigate to /search or /api/palette. */\nexport const value = 1;',
    { filePath: filename }
  );
  assert.equal(
    result.messages.filter((m) => m.ruleId === 'site/no-file-references')
      .length,
    1
  );
});

test('workflow comments are checked without rejecting configured file paths', async () => {
  const [result] = await eslint.lintText(
    '# Read package.json for the version.\nname: Check\nvalue: "scripts/run.mts"\n',
    { filePath: '.github/workflows/example.yml' }
  );
  assert.deepEqual(
    result.messages.map(({ ruleId, line }) => ({ ruleId, line })),
    [{ ruleId: 'site/no-file-references', line: 1 }]
  );
});
