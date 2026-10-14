import assert from 'node:assert/strict';
import test from 'node:test';

import { ProjectFrontmatterSchema } from '@/lib/projects/schema';

test('a title alone is a valid project with defaults', () => {
  const parsed = ProjectFrontmatterSchema.parse({ title: 'ParliPro' });
  assert.deepEqual(parsed.owners, []);
  assert.equal(parsed.weight, 0);
  assert.equal(parsed.visibility, 'public');
  assert.equal(parsed.draft, false);
  assert.deepEqual(parsed.media, []);
});

test('unknown keys fail instead of being dropped', () => {
  const result = ProjectFrontmatterSchema.safeParse({
    title: 'X',
    tagline: 'old field',
  });
  assert.equal(result.success, false);
});

test('owners must be known keys', () => {
  assert.equal(
    ProjectFrontmatterSchema.safeParse({ title: 'X', owners: ['lvbt'] })
      .success,
    true
  );
  assert.equal(
    ProjectFrontmatterSchema.safeParse({ title: 'X', owners: ['nobody'] })
      .success,
    false
  );
});

test('media is image, video, or document', () => {
  const parsed = ProjectFrontmatterSchema.parse({
    title: 'X',
    media: [
      { kind: 'image', src: '/a.webp', alt: 'A screenshot' },
      { kind: 'video', youtubeId: 'abc', title: 'A video' },
      { kind: 'document', href: '/report.pdf', title: 'A report' },
    ],
  });
  assert.equal(parsed.media.length, 3);
  assert.equal(
    ProjectFrontmatterSchema.safeParse({
      title: 'X',
      media: [{ kind: 'gif', src: '/a.gif' }],
    }).success,
    false
  );
});

test('an image needs a description unless it is marked decorative', () => {
  const image = (extra: object) =>
    ProjectFrontmatterSchema.safeParse({
      title: 'X',
      media: [{ kind: 'image', src: '/a.webp', ...extra }],
    }).success;
  assert.equal(image({ alt: '' }), false);
  assert.equal(image({ alt: '   ' }), false);
  assert.equal(image({ alt: '', decorative: true }), true);
  assert.equal(image({ alt: 'A screenshot', decorative: true }), false);
});

test('a website and a URL successor must be https', () => {
  assert.equal(
    ProjectFrontmatterSchema.safeParse({ title: 'X', website: 'http://x.com' })
      .success,
    false
  );
  assert.equal(
    ProjectFrontmatterSchema.safeParse({
      title: 'X',
      successor: 'https://x.com',
    }).success,
    true
  );
  assert.equal(
    ProjectFrontmatterSchema.safeParse({ title: 'X', successor: 'groundwork' })
      .success,
    true
  );
});

test('dates parse as local calendar days', () => {
  const parsed = ProjectFrontmatterSchema.parse({
    title: 'X',
    starts: '2023-01-09',
  });
  assert.equal(parsed.starts?.getDate(), 9);
});
