import { ESLint } from 'eslint';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const eslint = new ESLint();

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
    export function PartMilestones({ part }: { part: Part }) { return part; }
    export default function Page(props: PageProps<'/initiatives/[slug]/[part]'>) {
      return props.params;
    }`,
    { filePath: 'app/initiatives/[slug]/[part]/page.tsx' }
  );
  assert.deepEqual(result.messages, []);
});
