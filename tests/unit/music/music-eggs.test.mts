import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  musicAliases,
  offersCredits,
  playlistEnding,
} from '@/lib/music/easter-eggs';
import type { MusicPlaylist } from '@/lib/music/types';
import { matchCommands } from '@/lib/search/palette/commands';
import type { Command } from '@/lib/search/palette/types';

const entries = [
  ['7qgLqpNN5w1KwOnhEVojqz', 'A rainy train window', 'main character'],
  ['1CrRioD0EmSlk5jyndh6Oz', 'Ending montages', 'roll credits'],
  ['732snle3EiiBBSEYEyJzYv', 'Long entrances', 'get to the point'],
] as const;

test('secret phrases find only their intended playlist, regardless of title edits', () => {
  const commands: Command[] = entries.map(([id, title]) => ({
    id,
    title,
    keywords: musicAliases(id),
    group: 'Playlists',
    kind: 'music',
  }));
  for (const [id, , phrase] of entries) {
    assert.deepEqual(
      matchCommands(
        commands,
        `  ${phrase.toUpperCase().replaceAll(' ', '  ')}  `
      ).map((c) => c.id),
      [id]
    );
  }
  assert.deepEqual(matchCommands(commands, ''), []);
  assert.deepEqual(musicAliases('unrelated-playlist'), []);
});

test('only the ending-montage playlist offers film credits', () => {
  assert.equal(offersCredits(entries[1][0]), true);
  assert.equal(offersCredits(entries[0][0]), false);
  assert.equal(offersCredits(entries[2][0]), false);
  assert.equal(offersCredits(''), false);
});

function endingPlaylist(count: number, id = 'fixture'): MusicPlaylist {
  return {
    id,
    title: 'A playlist',
    description: '',
    image: null,
    url: 'https://open.spotify.com/playlist/fixture',
    ownerId: 'fixture',
    eligible: true,
    snapshot: 'fixture',
    checkedAt: new Date().toISOString(),
    error: null,
    trackCount: count,
    tracks: Array.from({ length: count }, () => ({
      title: 'A song',
      artist: 'An artist',
      duration: '3:00',
      durationMs: 180000,
      kind: 'track',
      url: null,
    })),
  };
}

test('playful endings start at 50 complete tracks and follow the agreed length tiers', () => {
  assert.equal(playlistEnding(endingPlaylist(49), []), null);
  for (const count of [50, 149])
    assert.equal(
      playlistEnding(endingPlaylist(count), [])?.message,
      'You found the end. For now.'
    );
  for (const count of [150, 299])
    assert.equal(
      playlistEnding(endingPlaylist(count), [])?.message,
      'That was the extended cut.'
    );
  assert.equal(
    playlistEnding(endingPlaylist(300), [])?.message,
    'That was the extended cut of the extended cut.'
  );
  const incomplete = { ...endingPlaylist(50), trackCount: 100 };
  assert.equal(playlistEnding(incomplete, []), null);
});

test('the long collection links to an available shorter Williecore by stable identity', () => {
  const collection = endingPlaylist(613, '62XTb89yYS322P7LODBSmU');
  const shorter = {
    ...endingPlaylist(56, '5AgpIU7pNfvef8FL9kvbYa'),
    title: 'Williecore',
  };
  assert.deepEqual(playlistEnding(collection, [shorter]), {
    message: 'There was a shorter version.',
    link: { id: shorter.id, title: shorter.title },
  });
  assert.equal(playlistEnding(collection, [])?.link, undefined);
  assert.equal(
    playlistEnding(collection, [{ ...shorter, eligible: false }])?.link,
    undefined
  );
  assert.equal(
    playlistEnding(collection, [endingPlaylist(700, shorter.id)])?.link,
    undefined
  );
  assert.equal(
    playlistEnding(collection, [{ ...shorter, tracks: [] }])?.link,
    undefined
  );
  assert.equal(
    playlistEnding(collection, [{ ...shorter, trackCount: 57 }])?.link,
    undefined
  );
  assert.equal(
    playlistEnding({ ...collection, title: 'Renamed collection' }, [shorter])
      ?.link?.id,
    shorter.id
  );
});
