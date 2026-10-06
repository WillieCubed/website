import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import * as media from '../../lib/media';

function fixture(t: { after: (fn: () => void) => void }) {
  const directory = mkdtempSync(join(tmpdir(), 'website-media-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

const source = `---
title: Campus research
publication: University News
url: https://example.com/research
published: "2023-07-12"
---
`;

test('media reads new and edited content files without changing source code', (t) => {
  assert.equal(typeof media.getMediaMentions, 'function');
  const directory = fixture(t);
  writeFileSync(join(directory, 'research.md'), source);
  let mentions = media.getMediaMentions({ directory });
  assert.equal(mentions[0].id, 'research');
  assert.equal(mentions[0].published, '2023-07-12');
  assert.equal(mentions[0].title, 'Campus research');
  writeFileSync(
    join(directory, 'research.md'),
    source.replace('Campus research', 'Updated headline')
  );
  writeFileSync(
    join(directory, 'another.md'),
    source.replace('Campus research', 'Another story')
  );
  mentions = media.getMediaMentions({ directory });
  assert.deepEqual(mentions.map((mention) => mention.title).sort(), [
    'Another story',
    'Updated headline',
  ]);
});

test('media excludes templates and keeps drafts out of published content', (t) => {
  assert.equal(typeof media.getMediaMentions, 'function');
  const directory = fixture(t);
  writeFileSync(
    join(directory, '_template.md'),
    'A template is not published content.'
  );
  writeFileSync(
    join(directory, 'draft.md'),
    source.replace('---\n', '---\ndraft: true\n')
  );
  assert.deepEqual(
    media.getMediaMentions({ directory, includeDrafts: false }),
    []
  );
  assert.equal(
    media.getMediaMentions({ directory, includeDrafts: true }).length,
    1
  );
});

test('media preserves optional presentation fields from content', (t) => {
  assert.equal(typeof media.getMediaMentions, 'function');
  const directory = fixture(t);
  writeFileSync(
    join(directory, 'research.md'),
    source.replace(
      '---\n',
      `---
excerpt: A short quotation.
image:
  src: /assets/example.webp
  alt: Students presenting their research.
  source: https://example.com/original.webp
  credit: Campus photographer
  fit: contain
featured: true
related:
  label: Research project
  href: /projects
`
    )
  );
  const [mention] = media.getMediaMentions({ directory });
  assert.equal(mention.excerpt, 'A short quotation.');
  assert.equal(mention.image?.alt, 'Students presenting their research.');
  assert.equal(mention.image?.source, 'https://example.com/original.webp');
  assert.equal(mention.image?.credit, 'Campus photographer');
  assert.equal(mention.image?.fit, 'contain');
  assert.equal(mention.featured, true);
  assert.equal(mention.related?.href, '/projects');
});

test('invalid media fails with the content filename rather than rendering broken data', (t) => {
  assert.equal(typeof media.getMediaMentions, 'function');
  const directory = fixture(t);
  const file = join(directory, 'broken.md');
  for (const invalid of [
    source.replace('2023-07-12', '2023-02-30'),
    source.replace('publication: University News\n', ''),
    source.replace('https://example.com/research', 'javascript:alert(1)'),
  ]) {
    writeFileSync(file, invalid);
    assert.throws(() => media.getMediaMentions({ directory }), /broken\.md/);
  }
});
