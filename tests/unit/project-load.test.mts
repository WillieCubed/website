import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  childrenOf,
  loadAllProjects,
  projectStatus,
} from '@/lib/projects/load';

const dir = 'tests/fixtures/projects';
const now = new Date(2026, 8, 28);

test('hidden projects and drafts are left out by default', () => {
  const slugs = loadAllProjects({ dir, now }).map((p) => p.slug);
  assert.deepEqual(slugs.sort(), ['alpha', 'beta', 'facts']);
});

test('drafts are included on request, hidden projects never are', () => {
  const slugs = loadAllProjects({ dir, now, includeDrafts: true }).map(
    (p) => p.slug
  );
  assert.ok(slugs.includes('draft'));
  assert.ok(!slugs.includes('hidden'));
});

test('weight sorts first, then the latest start', () => {
  const slugs = loadAllProjects({ dir, now }).map((p) => p.slug);
  assert.equal(slugs[0], 'alpha');
  assert.equal(slugs[1], 'beta');
});

test('a facts-only project has no body', () => {
  const facts = loadAllProjects({ dir, now }).find((p) => p.slug === 'facts');
  assert.equal(facts?.content, '');
});

test('a facts-only project has no media', () => {
  const facts = loadAllProjects({ dir, now }).find((p) => p.slug === 'facts');
  assert.deepEqual(facts?.media, []);
});

test('children are found by parent slug', () => {
  const all = loadAllProjects({ dir, now });
  assert.deepEqual(
    childrenOf(all, 'alpha').map((p) => p.slug),
    ['beta']
  );
});

test('status comes from the dates when missing', () => {
  const all = loadAllProjects({ dir, now });
  assert.equal(all.find((p) => p.slug === 'alpha')?.status, 'active');
  assert.equal(all.find((p) => p.slug === 'beta')?.status, 'complete');
  assert.equal(
    projectStatus(undefined, new Date(2027, 0, 1), undefined, now),
    'planned'
  );
  assert.equal(
    projectStatus('unreleased', undefined, undefined, now),
    'unreleased'
  );
});

test('an unknown parent fails loudly', () => {
  const temp = mkdtempSync(join(tmpdir(), 'projects-'));
  writeFileSync(
    join(temp, 'orphan.mdx'),
    '---\ntitle: Orphan\nparent: nobody\n---\n'
  );
  assert.throws(() => loadAllProjects({ dir: temp, now }), /parent "nobody"/);
});

test('an unknown successor slug fails loudly', () => {
  const temp = mkdtempSync(join(tmpdir(), 'projects-'));
  writeFileSync(
    join(temp, 'old.mdx'),
    '---\ntitle: Old\nsuccessor: nobody\n---\n'
  );
  assert.throws(
    () => loadAllProjects({ dir: temp, now }),
    /successor "nobody"/
  );
});
