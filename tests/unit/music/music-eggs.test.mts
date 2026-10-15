import assert from 'node:assert/strict';
import { test } from 'node:test';

import { musicAliases, offersCredits } from '@/lib/music/easter-eggs';
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
