import matter from 'gray-matter';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { InitiativeFrontmatterSchema } from '@/lib/initiatives/schema';

const base = {
  title: 'Example',
  tagline: 'One line.',
  description: 'A sentence.',
  kind: 'project',
};

test('an initiative website must be an absolute https URL', () => {
  const ok = InitiativeFrontmatterSchema.safeParse({
    ...base,
    website: 'https://example.willie.page',
  });
  assert.equal(ok.success, true);
  for (const website of ['http://example.com', '/initiatives/example']) {
    const bad = InitiativeFrontmatterSchema.safeParse({ ...base, website });
    assert.equal(bad.success, false, website);
  }
});

test('Superbloom points at its own site', () => {
  const { data } = matter(
    readFileSync('content/initiatives/superbloom/index.mdx', 'utf8')
  );
  const parsed = InitiativeFrontmatterSchema.parse(data);
  assert.equal(parsed.website, 'https://superbloom.willie.page');
});
