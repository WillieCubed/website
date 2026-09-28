import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { entityCards, entityKey } from '@/lib/entities/registry';
import { loadAllInitiatives } from '@/lib/initiatives';
import { isInternalHref } from '@/lib/site';
import { getWritingSlugs, loadWriting } from '@/lib/writings';

// Routes that answer with something other than a page, so they have no card.
const ROUTE_HANDLERS = new Set(['/coffee', '/tea', '/whoami', '/search']);

const LINK_PATTERNS = [
  /\]\((\/[^)\s]*)\)/g,
  /href="(\/[^"]*)"/g,
  /\]\((https:\/\/willie\.page[^)\s]*)\)/g,
];

function inSiteLinks(source: string): string[] {
  return LINK_PATTERNS.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1])
  ).filter((href) => isInternalHref(href) && !href.startsWith('/#'));
}

async function loadEverything(includeDrafts: boolean) {
  const slugs = await getWritingSlugs();
  const loaded = (
    await Promise.all(slugs.map((slug) => loadWriting(slug)))
  ).filter(({ writing }) => includeDrafts || !writing.draft);
  const initiatives = loadAllInitiatives({ includeDrafts });
  const cards = entityCards(
    loaded.map(({ writing }) => writing),
    initiatives
  );
  return {
    loaded,
    initiatives,
    known: new Set(cards.map((card) => entityKey(card.href))),
  };
}

function resolves(href: string, known: Set<string>): boolean {
  const key = entityKey(href);
  if (known.has(key) || ROUTE_HANDLERS.has(key)) return true;
  return existsSync(join(process.cwd(), 'public', key));
}

test('every in-site link in published prose reaches a published page', async () => {
  const { loaded, initiatives, known } = await loadEverything(false);
  const bodies = [
    ...loaded.map(({ writing, content }) => ({
      where: `content/writings/${writing.slug}`,
      source: content,
    })),
    ...initiatives.flatMap((initiative) => [
      { where: initiative.href, source: initiative.content },
      ...initiative.parts.map((part) => ({
        where: `${initiative.href}/${part.slug}`,
        source: part.content,
      })),
    ]),
  ];
  const dead = bodies.flatMap(({ where, source }) =>
    inSiteLinks(source)
      .filter((href) => !resolves(href, known))
      .map((href) => `${where} → ${href}`)
  );
  assert.deepEqual(dead, []);
});

// Link chips may name a draft because the page drops them until it ships,
// but a chip whose target does not exist at all is a typo.
test('every initiative link chip names a page that exists', async () => {
  const { initiatives, known } = await loadEverything(true);
  const dead = initiatives.flatMap((initiative) =>
    initiative.links
      .filter((link) => isInternalHref(link.href))
      .filter((link) => !resolves(link.href, known))
      .map((link) => `${initiative.href} → ${link.href}`)
  );
  assert.deepEqual(dead, []);
});
