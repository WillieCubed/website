import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { type MusicPlaylist, emptyCatalog } from '../../../lib/music/types';

registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { default: MusicExperience } =
  await import('../../../components/music/MusicExperience');
const { default: PaletteProvider } =
  await import('../../../components/search/palette/PaletteProvider');
const playlist: MusicPlaylist = {
  id: '7qgLqpNN5w1KwOnhEVojqz',
  title: 'A long playlist title that already has a place in the gallery',
  description: '',
  image: null,
  url: 'https://open.spotify.com/playlist/7qgLqpNN5w1KwOnhEVojqz',
  ownerId: 'owner',
  eligible: true,
  snapshot: 'known',
  tracks: [],
  trackCount: 0,
  checkedAt: new Date().toISOString(),
  error: null,
};
function markup(
  loading: boolean,
  playlists: MusicPlaylist[],
  mode: 'public' | 'admin' = 'public'
) {
  const ids = playlists.map((p) => p.id);
  return renderToStaticMarkup(
    createElement(
      PaletteProvider,
      null,
      createElement(MusicExperience, {
        mode,
        loading,
        playlists,
        initialCatalog: { ...emptyCatalog, order: ids, selected: ids },
      })
    )
  );
}
test('known gallery cards stay in place with identical markup while other data loads', () => {
  const pending = markup(true, [playlist]);
  const ready = markup(false, [playlist]);
  assert.doesNotMatch(pending, /mp-card-pending/);
  assert.match(pending, /A long playlist title/);
  const cards = (html: string) => html.match(/<article\b[\s\S]*?<\/article>/g);
  assert.deepEqual(cards(pending), cards(ready));
});
test('an unknown collection uses decorative cards without invented titles or counts', () => {
  const pending = markup(true, []);
  assert.equal(
    (pending.match(/class="mp-card mp-card-pending"/g) || []).length,
    6
  );
  assert.doesNotMatch(pending, /A long playlist title/);
});

test('known curation content remains readable while editing controls wait for the load', () => {
  const pending = markup(true, [playlist], 'admin');
  const ready = markup(false, [playlist], 'admin');
  assert.doesNotMatch(pending, /mp-card-pending/);
  assert.match(pending, /A long playlist title/);
  assert.match(pending, /<input\b(?=[^>]*type="checkbox")(?=[^>]*disabled="")/);
  assert.doesNotMatch(
    ready,
    /<input\b(?=[^>]*type="checkbox")(?=[^>]*disabled="")/
  );
});
