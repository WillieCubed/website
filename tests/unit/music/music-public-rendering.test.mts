import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { emptyCatalog } from '../../../lib/music/types';

registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { default: MusicPublicExperience } =
  await import('../../../components/music/MusicPublicExperience');
const { default: PaletteProvider } =
  await import('../../../components/search/palette/PaletteProvider');

const playlist = {
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

test('public gallery keeps native playlist and series destinations without curation controls', () => {
  const html = renderToStaticMarkup(
    createElement(
      PaletteProvider,
      null,
      createElement(MusicPublicExperience, {
        playlists: [playlist],
        initialCatalog: {
          ...emptyCatalog,
          selected: [playlist.id],
          order: [playlist.id],
          series: [
            { id: 'sequence', title: 'Sequence', playlistIds: [playlist.id] },
          ],
        },
      })
    )
  );
  assert.match(html, /href="\/music\?detail=/);
  assert.match(html, /href="\/music\?series=sequence"/);
  assert.doesNotMatch(
    html,
    /type="checkbox"|Create a series|Choose playlists|music-context-editor/
  );
});

test('a direct public detail includes tracks, provider links, credits, and its ending in server HTML', () => {
  const creditsPlaylist = {
    ...playlist,
    id: '1CrRioD0EmSlk5jyndh6Oz',
    trackCount: 50,
    tracks: Array.from({ length: 50 }, (_, index) => ({
      title: `Song ${index + 1}`,
      artist: 'An artist',
      duration: '3:00',
      durationMs: 180000,
      kind: 'track' as const,
      url: `https://open.spotify.com/track/${index + 1}`,
    })),
  };
  const html = renderToStaticMarkup(
    createElement(
      PaletteProvider,
      null,
      createElement(MusicPublicExperience, {
        playlists: [creditsPlaylist],
        initialDetail: creditsPlaylist.id,
        initialCatalog: {
          ...emptyCatalog,
          selected: [creditsPlaylist.id],
          order: [creditsPlaylist.id],
        },
      })
    )
  );
  assert.match(html, /<dialog[^>]*open=""/);
  assert.match(html, /href="https:\/\/open.spotify.com\/track\/1"/);
  assert.match(html, /Song 50/);
  assert.match(html, /Roll credits/);
  assert.match(html, /You found the end. For now./);
  assert.doesNotMatch(html, /music-context-editor|type="checkbox"/);
});
