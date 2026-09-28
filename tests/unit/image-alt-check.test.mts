import {
  validateMdxImageAlts,
  validateTsxImageAlts,
} from '@/scripts/image-alt-check';
import assert from 'node:assert/strict';
import test from 'node:test';

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
  assert.ok(issues.some((item) => item.message.startsWith('photo[0]')));
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

test('writing photos require a description even with a decorative marker', () => {
  const source = `---
photo:
  - url: /photo.jpg
    alt: ''
    decorative: true
---`;
  assert.match(
    validateMdxImageAlts('post.mdx', source)[0].message,
    /photo\[0\].*nonblank alt/
  );
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

test('authored JSX catches empty expressions and imported image aliases', () => {
  const source = `import NextImage from 'next/image';
<><NextImage src="/a.jpg" /><img src="/b.jpg" alt={undefined} /><img src="/c.jpg" alt={\`\`} /><img src="/d.jpg" alt={name ?? null} /></>`;
  assert.equal(validateTsxImageAlts('image.tsx', source).length, 4);
  assert.deepEqual(
    validateTsxImageAlts(
      'image.tsx',
      `<><img src="/a.jpg" alt="" aria-hidden='true' /><img src="/b.jpg" alt={name} /></>`
    ),
    []
  );
});

test('MDX gallery items cannot hide missing alt behind object spreads', () => {
  const source = `<Gallery items={[{ ...image }, { src: '/photo.jpg' }]} />`;
  const issues = validateMdxImageAlts('gallery.mdx', source);
  assert.equal(issues.length, 2);
  assert.match(issues[0].message, /literal image fields/);
  assert.match(issues[1].message, /nonblank alt/);
});
