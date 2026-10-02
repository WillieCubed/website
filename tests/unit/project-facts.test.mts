import assert from 'node:assert/strict';
import test from 'node:test';

import { projectSeed } from '@/lib/projects/brand';
import { linkLabel, projectFacts, projectYears } from '@/lib/projects/facts';
import type { Project } from '@/lib/projects/schema';

const base: Project = {
  slug: 'parlipro',
  href: '/projects/parlipro',
  title: 'ParliPro',
  owners: [],
  roles: ['Creator', 'Lead Developer'],
  collaborators: [],
  weight: 0,
  visibility: 'public',
  media: [],
  links: [],
  draft: false,
  status: 'unreleased',
  starts: new Date(2023, 0, 9),
  content: '',
};

test('years collapse to one, span two, or stay open while active', () => {
  assert.equal(projectYears(base), '2023');
  assert.equal(
    projectYears({ ...base, ends: new Date(2024, 3, 1) }),
    '2023–2024'
  );
  assert.equal(projectYears({ ...base, status: 'active' }), '2023–');
  assert.equal(projectYears({ ...base, starts: undefined }), undefined);
});

test('facts read roles, owners, years, then status', () => {
  assert.deepEqual(projectFacts(base), [
    'Creator',
    'Lead Developer',
    '2023',
    'Unreleased',
  ]);
  assert.deepEqual(
    projectFacts({ ...base, roles: [], owners: ['asa'], status: 'complete' }),
    ['American Society on Aging', '2023', 'Complete']
  );
});

test('an unlabeled link shows its host and path', () => {
  assert.equal(
    linkLabel('https://github.com/WillieCubed/parlipro'),
    'github.com/WillieCubed/parlipro'
  );
  assert.equal(
    linkLabel('https://parlipro.vercel.app/'),
    'parlipro.vercel.app'
  );
  assert.equal(linkLabel('https://www.asaging.org/'), 'asaging.org');
});

test('the seed is the project brand, then its slug, then its first owner', () => {
  const table = { lvbt: { hex: '#e5471a' }, parlipro: { hex: '#cc8888' } };
  assert.equal(
    projectSeed({ slug: 'x', brand: '#123456', owners: [] }, table),
    '#123456'
  );
  assert.equal(
    projectSeed({ slug: 'x', brand: 'lvbt', owners: [] }, table),
    '#e5471a'
  );
  assert.equal(projectSeed({ slug: 'parlipro', owners: [] }, table), '#cc8888');
  assert.equal(
    projectSeed({ slug: 'x', owners: ['acm', 'lvbt'] }, table),
    '#e5471a'
  );
  assert.equal(projectSeed({ slug: 'x', owners: [] }, table), undefined);
});
