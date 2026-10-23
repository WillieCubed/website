import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { adminCollectionView } from '../../../components/music/music-admin-collection';
import { type MusicPlaylist, emptyCatalog } from '../../../lib/music/types';

registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { default: MusicAdminExperience } =
  await import('../../../components/music/MusicAdminExperience');
const { default: MusicPublicExperience } =
  await import('../../../components/music/MusicPublicExperience');
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
      createElement(
        mode === 'admin' ? MusicAdminExperience : MusicPublicExperience,
        {
          loading,
          playlists,
          initialCatalog: { ...emptyCatalog, order: ids, selected: ids },
        }
      )
    )
  );
}
test('known gallery cards stay in place with identical markup while other data loads', () => {
  const pending = markup(true, [playlist]);
  const ready = markup(false, [playlist]);
  assert.doesNotMatch(pending, /music-card-pending/);
  assert.match(pending, /A long playlist title/);
  const cards = (html: string) => html.match(/<article\b[\s\S]*?<\/article>/g);
  assert.deepEqual(cards(pending), cards(ready));
});
test('an unknown collection uses decorative cards without invented titles or counts', () => {
  const pending = markup(true, []);
  assert.equal(
    (pending.match(/class="music-card music-card-pending"/g) || []).length,
    6
  );
  assert.doesNotMatch(pending, /A long playlist title/);
});

test('known curation content remains readable while editing controls wait for the load', () => {
  const pending = markup(true, [playlist], 'admin');
  const ready = markup(false, [playlist], 'admin');
  assert.doesNotMatch(pending, /music-card-pending/);
  assert.match(pending, /A long playlist title/);
  assert.match(pending, /<input\b(?=[^>]*type="checkbox")(?=[^>]*disabled="")/);
  assert.doesNotMatch(
    ready,
    /<input\b(?=[^>]*type="checkbox")(?=[^>]*disabled="")/
  );
});

for (const hasRevision of [false, true]) {
  test(`a recovered editor seed stays distinct from the ${hasRevision ? 'confirmed' : 'missing'} server revision`, () => {
    const recovered = {
      ...emptyCatalog,
      order: [playlist.id],
      selected: [playlist.id],
    };
    const revision = hasRevision
      ? {
          id: 'saved-head',
          body: emptyCatalog,
          createdAt: '2026-10-16T12:00:00.000Z',
          conflict: false,
        }
      : null;
    const data = { revision, playlists: [playlist] };
    const view = adminCollectionView(
      data,
      { connected: true, configured: true, reconnect: false, ownerId: 'owner' },
      recovered
    );
    assert.equal(view.initialCatalog, recovered);
    assert.equal(view.setupInitially, false);
    assert.equal(data.revision, revision);
    assert.equal(data.revision?.body, hasRevision ? emptyCatalog : undefined);
  });
}
