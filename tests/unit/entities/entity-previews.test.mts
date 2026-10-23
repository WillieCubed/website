import assert from 'node:assert/strict';
import test from 'node:test';

import { materialSchemeVars } from '@/lib/brand/material-scheme';
import { prepareEntityPreviews } from '@/lib/entities/previews';
import type { EntityCard } from '@/lib/entities/types';

const card: EntityCard = {
  href: '/projects/example',
  kind: 'project',
  title: 'Example',
  description: 'A project.',
  brand: '#c2410c',
};

test('preview serialization supplies the same light and dark Fidelity roles as the existing theme', () => {
  const [prepared] = prepareEntityPreviews([card]);
  assert.deepEqual(prepared.scheme, materialSchemeVars('#c2410c'));
  assert.equal(prepared.brand, card.brand);
  assert.equal(prepared.href, card.href);
  assert.equal('scheme' in card, false);
});

test('unbranded previews preserve their public representation', () => {
  const { brand: _brand, ...plain } = card;
  assert.deepEqual(prepareEntityPreviews([plain]), [plain]);
});

test('cards sharing a seed reuse prepared roles without sharing mutable card records', () => {
  const [first, second] = prepareEntityPreviews([
    card,
    { ...card, href: '/projects/other' },
  ]);
  assert.equal(first.scheme, second.scheme);
  assert.notEqual(first, second);
});
