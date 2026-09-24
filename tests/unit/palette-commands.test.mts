import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  buildCommands,
  findEgg,
  groupCommands,
  matchCommands,
} from '@/lib/palette/commands';
import { excerptParts } from '@/lib/palette/search';
import type { PaletteData } from '@/lib/palette/types';
import { routedPages } from '@/lib/site';

const data: PaletteData = {
  latestWriting: {
    title: 'Project Superbloom',
    href: '/writings/project-superbloom',
    detail: 'Sep 1, 2026',
  },
  currentPart: {
    title: 'Stop 2: Reno',
    href: '/initiatives/fall-tour-2026/part-2',
    detail: 'Fall Tour 2026',
  },
  writings: [
    {
      title: 'Project Superbloom',
      href: '/writings/project-superbloom',
      detail: 'Sep 1, 2026',
    },
    {
      title: 'Coffee and code',
      href: '/writings/coffee-and-code',
      detail: 'Aug 2, 2026',
    },
  ],
  initiatives: [
    {
      title: 'Fall Tour 2026',
      href: '/initiatives/fall-tour-2026',
      detail: 'A tour',
    },
  ],
  ventures: [
    {
      title: 'Hypertext Studio',
      href: '/?detail=hypertext',
      detail: 'Venture',
    },
  ],
};

const commands = buildCommands(data);
const eggs = commands.filter((command) => command.egg);

test('every command id is unique', () => {
  const ids = commands.map((command) => command.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('an exact egg name finds its egg, ignoring case and outer spaces', () => {
  assert.equal(findEgg(commands, 'brew')?.id, 'egg:brew');
  assert.equal(findEgg(commands, 'coffee')?.id, 'egg:brew');
  assert.equal(findEgg(commands, '  TEAPOT ')?.id, 'egg:brew');
  assert.equal(findEgg(commands, 'tea')?.id, 'egg:tea');
  assert.equal(findEgg(commands, ':q')?.id, 'egg:quit');
  assert.equal(findEgg(commands, 'exit')?.id, 'egg:quit');
});

test('a partial or padded egg name never reaches an egg', () => {
  for (const typed of ['bre', 'brewing', 'te', 'whoam', 'sudo su', ':', 'x']) {
    assert.equal(findEgg(commands, typed), undefined, typed);
  }
  assert.equal(findEgg(commands, ''), undefined);
});

test('eggs never appear in a list, whatever is typed', () => {
  const names = eggs.flatMap((egg) => [egg.title, ...egg.keywords]);
  for (const typed of ['', ...names, 'b', 'co', 'sec', 'q']) {
    const listed = matchCommands(commands, typed);
    assert.ok(
      listed.every((command) => !command.egg),
      `"${typed}" listed an egg`
    );
  }
});

test('every egg the spec names is registered', () => {
  const names = new Set(eggs.flatMap((egg) => [egg.title, ...egg.keywords]));
  for (const name of [
    'brew',
    'coffee',
    'teapot',
    'tea',
    'whoami',
    'fortune',
    'clacks',
    'mcp',
    'llms',
    'security',
    'sudo',
    ':q',
    'exit',
  ]) {
    assert.ok(names.has(name), name);
  }
});

test('the empty palette shows Latest, Go to, and Do', () => {
  const groups = groupCommands(matchCommands(commands, '')).map(
    (entry) => entry.group
  );
  assert.deepEqual(groups, ['Latest', 'Go to', 'Do']);
});

test('typing finds commands by title first, and each place once', () => {
  const found = matchCommands(commands, 'superbloom');
  assert.equal(found.length, 1);
  assert.equal(found[0].href, '/writings/project-superbloom');

  const writings = matchCommands(commands, 'writ');
  assert.equal(writings[0].href, '/writings');
});

test('the typed word coffee lists the writing but runs the egg on Enter', () => {
  const listed = matchCommands(commands, 'coffee');
  assert.ok(listed.some((command) => command.href?.includes('coffee')));
  assert.equal(findEgg(commands, 'coffee')?.id, 'egg:brew');
});

test('Go to pages point at routes that exist', () => {
  const pages = commands.filter(
    (command) => command.group === 'Go to' && command.kind === 'page'
  );
  const known = new Set(['/', ...routedPages.map((page) => page.path)]);
  assert.ok(pages.length > 1);
  for (const page of pages) {
    assert.ok(known.has(page.href ?? ''), page.href);
    const route = path.join(process.cwd(), 'app', page.href ?? '', 'page.tsx');
    assert.ok(existsSync(route), `${page.href} has no app route`);
  }
});

test('excerptParts splits marks and decodes entities without parsing HTML', () => {
  assert.deepEqual(
    excerptParts('a <mark>tea</mark>pot &amp; <b>cup</b> &lt;3'),
    [
      { text: 'a ', mark: false },
      { text: 'tea', mark: true },
      { text: 'pot & cup <3', mark: false },
    ]
  );
});

test('excerptParts keeps escaped markup in content as text', () => {
  assert.deepEqual(excerptParts('use &lt;b&gt; here'), [
    { text: 'use <b> here', mark: false },
  ]);
});
