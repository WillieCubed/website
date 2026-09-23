import assert from 'node:assert/strict';
import test from 'node:test';

import { getWritingSlugs, loadWriting } from '@/lib/writings';
import { parsePersonTags } from '@/lib/writings/person-tags';

test('parsePersonTags keeps entries with a name and an absolute http(s) url', () => {
  assert.deepEqual(
    parsePersonTags([
      { name: ' Jane Doe ', url: ' https://janedoe.example ' },
      { name: 'Sam', url: 'http://sam.example/about' },
    ]),
    [
      { name: 'Jane Doe', url: 'https://janedoe.example/' },
      { name: 'Sam', url: 'http://sam.example/about' },
    ]
  );
});

test('parsePersonTags drops malformed and repeated entries', () => {
  assert.deepEqual(
    parsePersonTags([
      { name: '', url: 'https://empty-name.example' },
      { name: 'No URL' },
      { name: 'Relative', url: '/about' },
      { name: 'Mail', url: 'mailto:someone@example.com' },
      'https://bare-string.example',
      null,
      { name: 'Jane Doe', url: 'https://janedoe.example' },
      { name: 'Jane again', url: 'https://janedoe.example/' },
    ]),
    [{ name: 'Jane Doe', url: 'https://janedoe.example/' }]
  );
});

test('parsePersonTags returns nothing when people is absent or not a list', () => {
  assert.deepEqual(parsePersonTags(undefined), []);
  assert.deepEqual(
    parsePersonTags({ name: 'Jane', url: 'https://j.example' }),
    []
  );
});

test('loadWriting gives every writing a people list', async () => {
  for (const slug of await getWritingSlugs()) {
    const { writing } = await loadWriting(slug);
    assert.ok(Array.isArray(writing.people), `${slug}: people`);
  }
});
