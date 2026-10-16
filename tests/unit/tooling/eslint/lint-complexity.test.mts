import { ESLint } from 'eslint';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Syntax cases use virtual paths; numeric cases exercise the real type-aware configuration.
const eslint = new ESLint({
  overrideConfig: {
    languageOptions: { parserOptions: { projectService: false } },
    rules: { '@typescript-eslint/strict-boolean-expressions': 'off' },
  },
});

async function rejects(
  code: string,
  rule: string,
  filePath = 'lib/example/value.ts'
) {
  const [result] = await eslint.lintText(code, { filePath });
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === rule && message.severity === 2
    ),
    `Expected ${rule} to reject this code: ${JSON.stringify(result.messages)}`
  );
}

test('lint rejects functions with more than ten independent paths', async () => {
  await rejects(
    `export function classify(value: number) {
    ${Array.from({ length: 10 }, (_, i) => `if (value === ${i}) return ${i};`).join('\n')}
    return -1;
  }`,
    'complexity'
  );
});

test('lint rejects deeply nested reasoning in TypeScript scripts', async () => {
  await rejects(
    `export function nested(value: boolean) {
    if (value) { if (value) { if (value) { if (value) { if (value) {
      if (value) return 1;
    } } } } }
    return 0;
  }`,
    'sonarjs/cognitive-complexity',
    'scripts/example/check.mts'
  );
});

test('lint rejects more than four nested blocks', async () => {
  await rejects(
    `export function nested(value: boolean) {
    if (value) { if (value) { if (value) { if (value) { if (value) return 1; } } } }
    return 0;
  }`,
    'max-depth'
  );
});

test('simplified social views cannot reintroduce nested ternaries', async () => {
  await rejects(
    'export const label = (active: boolean, busy: boolean) => active ? busy ? "Waiting" : "Active" : "Ready";',
    'no-nested-ternary',
    'components/writings/StandardSocialControls.tsx'
  );
});

test('lint accepts straightforward typed code', async () => {
  const [result] = await eslint.lintText(
    `export function label(active: boolean): string {
    if (active) return 'Subscribed';
    return 'Subscribe';
  }`,
    { filePath: 'lib/example/value.ts' }
  );
  assert.deepEqual(result.messages, []);
});

test('UI contracts reject three nested inference utilities', async () => {
  await rejects(
    `export type Props = {
      part: NonNullable<Awaited<ReturnType<typeof getPart>>>['part'];
    };`,
    'no-restricted-syntax',
    'components/initiatives/PartMilestones.tsx'
  );
});

test('page contracts use generated route props instead of manual params shapes', async () => {
  await rejects(
    `export default function Page(props: {
      params: Promise<{ slug: string; part: string }>;
    }) { return props.params; }`,
    'no-restricted-syntax',
    'app/initiatives/[slug]/[part]/page.tsx'
  );
});

test('named domain types and generated route props remain valid UI contracts', async () => {
  const [result] = await eslint.lintText(
    `import type { Part } from '@/lib/initiatives';
    interface PartMilestonesProps { part: Part }
    export function PartMilestones({ part }: PartMilestonesProps) { return part; }
    export default function Page(props: PageProps<'/initiatives/[slug]/[part]'>) {
      return props.params;
    }`,
    { filePath: 'app/initiatives/[slug]/[part]/page.tsx' }
  );
  assert.deepEqual(result.messages, []);
});

test('UI parameter contracts reject inline objects and utility fragments', async () => {
  for (const code of [
    'export function Notice({ error }: { error: string }) { return error; }',
    'export const Notice = ({ error }: { error: string }) => error;',
    'export function Notice({ error }: { error?: string } = {}) { return error; }',
    'export function Notice(props: { error?: string } = {}) { return props.error; }',
    'interface NoticeProps { error?: string } export function Notice(props: Partial<NoticeProps> = {}) { return props.error; }',
    'export const Notice: React.FC<{ error: string }> = ({ error }) => error;',
    'export const Notice: React.ComponentType<{ error: string }> = ({ error }) => error;',
    'export const Notice = memo<{ error: string }>(props => props.error);',
    'export const Notice = React.forwardRef<HTMLDivElement, { error: string }>((props) => props.error);',
    'interface NoticeProps { error: string } export const Notice: React.FC<Partial<NoticeProps>> = props => props.error;',
    'interface NoticeProps { error: string } export const Notice: React.ComponentType<Partial<NoticeProps>> = props => props.error;',
    'interface NoticeProps { error: string } export const Notice = memo<Partial<NoticeProps>>(props => props.error);',
    'interface NoticeProps { error: string } export const Notice = forwardRef<HTMLDivElement, Partial<NoticeProps>>(props => props.error);',

    "interface Playlist { id: string; title: string } export function Open(props: Pick<Playlist, 'id'>) { return props.id; }",
    "interface Options { playlists: Pick<Playlist, 'id' | 'title'>[] } export type Playlist = { id: string; title: string };",
  ])
    await rejects(
      code,
      'no-restricted-syntax',
      'components/music/MusicAdminNotices.tsx'
    );
});

test('UI object contracts use interfaces instead of object type aliases', async () => {
  await rejects(
    'export type NoticeProps = { error: string };',
    '@typescript-eslint/consistent-type-definitions',
    'components/music/MusicAdminNotices.tsx'
  );
});

test('numeric boolean contexts require explicit comparisons', async () => {
  const typed = new ESLint();
  for (const code of [
    'export const label = (count: number) => count ? "Some" : "None";',
    'export function hasItems(items: string[]) { if (items.length) return true; return false; }',
    'export const empty = (count: number) => !count;',
    'export const label = (count: number) => count && "Some";',
    'export const fallback = (count?: number) => count || 10;',
    'export const optional = (count?: number) => count ? "Some" : "None";',
  ]) {
    const [result] = await typed.lintText(code, {
      filePath: 'lib/music/publication-message.ts',
    });
    assert.ok(
      result.messages.some(
        (message) =>
          message.ruleId === '@typescript-eslint/strict-boolean-expressions' &&
          message.severity === 2
      ),
      JSON.stringify(result.messages)
    );
  }
});

test('explicit counts, nullable objects, and named props stay valid', async () => {
  const typed = new ESLint();
  const [result] = await typed.lintText(
    `
    interface NoticeProps { count: number; item?: { title: string } }
    export function Notice({ count, item }: NoticeProps) {
      if (count > 0 && item) return item.title;
      return count === 0 ? 'None' : 'Some';
    }
  `,
    { filePath: 'components/music/MusicAdminNotices.tsx' }
  );
  assert.deepEqual(result.messages, []);
});

test('JavaScript numeric truthiness uses the same precommit rules', async () => {
  const typed = new ESLint();
  const [result] = await typed.lintText(
    '/** @param {number} count */ export function label(count) { return count ? "Some" : "None"; }',
    { filePath: 'brand/type-scale.mjs' }
  );
  assert.ok(
    result.messages.some(
      (message) =>
        message.ruleId === '@typescript-eslint/strict-boolean-expressions' &&
        message.severity === 2
    ),
    JSON.stringify(result.messages)
  );
});
