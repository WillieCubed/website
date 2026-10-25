import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { default: PartNav } = await import('@/components/initiatives/PartNav');

const initiative = {
  title: 'Fall Tour 2026',
  partLabel: 'Part',
  href: '/initiatives/fall-tour-2026',
  parts: [1, 2, 3, 4].map((number) => ({
    number,
    slug: `part-${number}`,
    title: `Destination ${number}`,
  })),
};

test('part navigation uses native adjacent destinations with SVG icons and no redundant overview action', () => {
  const html = renderToStaticMarkup(
    createElement(PartNav, { initiative, part: { number: 3 } })
  );
  assert.match(html, /href="\/initiatives\/fall-tour-2026\/part-2"/);
  assert.match(html, /href="\/initiatives\/fall-tour-2026\/part-4"/);
  assert.equal((html.match(/<svg\b/g) || []).length, 2);
  assert.doesNotMatch(html, /[←→]|All of|<button\b|class="part-nav__overview/);
  assert.doesNotMatch(html, /href="\/initiatives\/fall-tour-2026"/);
});

for (const number of [1, 4]) {
  test(`part ${number} renders only its available neighbor`, () => {
    const html = renderToStaticMarkup(
      createElement(PartNav, { initiative, part: { number } })
    );
    assert.equal((html.match(/<a\b/g) || []).length, 1);
    assert.match(html, new RegExp(`rel="${number === 1 ? 'next' : 'prev'}"`));
  });
}
