import assert from 'node:assert/strict';
import test from 'node:test';

import { projectSeed } from '@/lib/projects/brand';
import {
  linkLabel,
  projectFacts,
  projectLinkChips,
  projectYears,
} from '@/lib/projects/facts';
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

const nobody = { initiative: null, successor: null };

test('the own site leads and keeps its labeled link', () => {
  const chips = projectLinkChips(
    {
      ...base,
      website: 'https://parlipro.vercel.app/',
      links: [
        { href: 'https://github.com/WillieCubed/parlipro', label: 'Code' },
        { href: 'https://parlipro.vercel.app/', label: 'Web App' },
      ],
    },
    nobody
  );
  assert.deepEqual(chips, [
    { href: 'https://parlipro.vercel.app/', label: 'Web App', primary: true },
    {
      href: 'https://github.com/WillieCubed/parlipro',
      label: 'Code',
      primary: false,
    },
  ]);
});

test('an own site with no matching link shows its host', () => {
  const chips = projectLinkChips(
    { ...base, website: 'https://parlipro.vercel.app/' },
    nobody
  );
  assert.deepEqual(chips, [
    {
      href: 'https://parlipro.vercel.app/',
      label: 'parlipro.vercel.app',
      primary: true,
    },
  ]);
});

test('an external successor is a chip even when nothing else links out', () => {
  const chips = projectLinkChips(
    { ...base, successor: 'https://newapp.example/start' },
    nobody
  );
  assert.deepEqual(chips, [
    {
      href: 'https://newapp.example/start',
      label: 'newapp.example/start',
      primary: false,
    },
  ]);
});

test('an initiative and a project successor follow the links', () => {
  const chips = projectLinkChips(
    { ...base, links: [{ href: 'https://example.com/a', label: 'A' }] },
    {
      initiative: {
        title: 'Fall Tour 2026',
        href: '/initiatives/fall-tour-2026',
      },
      successor: { title: 'ParliPro 2', href: '/projects/parlipro-2' },
    }
  );
  assert.deepEqual(
    chips.map((chip) => [chip.label, chip.primary]),
    [
      ['A', true],
      ['Fall Tour 2026', false],
      ['ParliPro 2', false],
    ]
  );
});

test('a project with nothing to link to has no chips', () => {
  assert.deepEqual(projectLinkChips(base, nobody), []);
  // A slug successor that resolves to no project adds nothing.
  assert.deepEqual(
    projectLinkChips({ ...base, successor: 'parlipro-2' }, nobody),
    []
  );
});
