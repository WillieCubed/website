import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateMdxImageAlts,
  validateTsxImageAlts,
} from '@/lib/accessibility/content-alt';

test('authored MDX rejects missing descriptions even in drafts', () => {
  const source = `---
draft: true
featuredImage: /cover.jpg
photo:
  - url: /photo.jpg
cover:
  src: /initiative.jpg
  alt: '   '
---

![](/body.jpg)

<Figure src="/figure.jpg" />

<Gallery items={[{ src: '/gallery.jpg' }]} />`;
  const issues = validateMdxImageAlts('draft.mdx', source);
  assert.equal(issues.length, 6);
  assert.ok(issues.some((item) => item.message.startsWith('featuredImage:')));
  assert.ok(issues.some((item) => item.message.startsWith('Photo 1')));
});

test('authored MDX accepts descriptions and deliberately decorative JSX', () => {
  const source = `---
featuredImage: /cover.jpg
featuredImageAlt: A red cover
photo:
  - url: /photo.jpg
    alt: A bus at dusk
---

![Two people at a bus stop](/body.jpg)

<Figure src="/figure.jpg" alt="" aria-hidden="true" />

<Gallery items={[{ src: '/gallery.jpg', alt: 'A crowd at the station' }]} />`;
  assert.deepEqual(validateMdxImageAlts('post.mdx', source), []);
});

test('authored JSX requires explicit image alt and decorative intent', () => {
  const issues = validateTsxImageAlts(
    'image.tsx',
    '<><img src="/a.jpg" /><Image src="/b.jpg" alt="" /><Image src="/c.jpg" alt={name ?? ""} /></>'
  );
  assert.equal(issues.length, 3);
  assert.deepEqual(
    validateTsxImageAlts(
      'image.tsx',
      '<><img src="/a.jpg" alt="A tree" /><Image src="/b.jpg" alt="" aria-hidden="true" /></>'
    ),
    []
  );
});
