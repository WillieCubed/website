import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  appendCatalogSeries,
  appendImportedPlaylistOrder,
  dropCatalog,
  reorderCatalog,
  toggleCatalogFeature,
  toggleCatalogMembership,
  toggleCatalogSelection,
  updateCatalogNote,
} from '../../../lib/music/catalog-edits';
import type { MusicCatalog } from '../../../lib/music/types';

const catalog: MusicCatalog = {
  version: 1,
  order: ['one', 'two', 'three'],
  selected: ['one', 'two'],
  lead: 'one',
  notes: { one: 'Keep the opening track.' },
  series: [
    { id: 'first', title: 'First series', playlistIds: ['two', 'one'] },
    { id: 'second', title: 'Second series', playlistIds: ['one', 'three'] },
  ],
};

test('deselecting the feature clears only its public feature and selection', () => {
  const next = toggleCatalogSelection(catalog, 'one');
  assert.deepEqual(next.selected, ['two']);
  assert.equal(next.lead, null);
  assert.equal(next.notes, catalog.notes);
  assert.equal(next.series, catalog.series);
  assert.equal(catalog.lead, 'one');
  assert.deepEqual(catalog.selected, ['one', 'two']);
  assert.equal(toggleCatalogSelection(catalog, 'two').lead, 'one');
});

test('featuring an excluded playlist includes it once and clearing the feature keeps it selected', () => {
  const featured = toggleCatalogFeature(catalog, 'three');
  assert.equal(featured.lead, 'three');
  assert.deepEqual(featured.selected, ['one', 'two', 'three']);
  const cleared = toggleCatalogFeature(featured, 'three');
  assert.equal(cleared.lead, null);
  assert.equal(cleared.selected, featured.selected);
  assert.equal(cleared.order, catalog.order);
});

test('gallery and series moves keep their independent sequences', () => {
  const gallery = reorderCatalog(catalog, 'two', -1, null);
  assert.deepEqual(gallery.order, ['two', 'one', 'three']);
  assert.equal(gallery.series, catalog.series);
  const series = reorderCatalog(catalog, 'one', -1, 'first');
  assert.deepEqual(series.series[0].playlistIds, ['one', 'two']);
  assert.equal(series.order, catalog.order);
  assert.equal(series.series[1], catalog.series[1]);
  assert.deepEqual(catalog.series[0].playlistIds, ['two', 'one']);
  assert.equal(reorderCatalog(catalog, 'one', -1, null).order, catalog.order);
});

test('a drop inserts before its target using the active order without changing other series', () => {
  const gallery = dropCatalog(catalog, catalog.order, 'one', 'three', null);
  assert.deepEqual(gallery.order, ['two', 'one', 'three']);
  assert.equal(gallery.series, catalog.series);
  const series = dropCatalog(
    catalog,
    catalog.series[0].playlistIds,
    'one',
    'two',
    'first'
  );
  assert.deepEqual(series.series[0].playlistIds, ['one', 'two']);
  assert.equal(series.series[1], catalog.series[1]);
  assert.equal(series.order, catalog.order);
});

test('notes preserve authored whitespace and empty entries while membership preserves private context', () => {
  const written = updateCatalogNote(catalog, 'three', '  An ending.\n');
  assert.equal(written.notes.three, '  An ending.\n');
  const emptied = updateCatalogNote(written, 'three', '');
  assert.ok(Object.hasOwn(emptied.notes, 'three'));
  assert.equal(emptied.notes.three, '');
  assert.deepEqual(catalog.notes, { one: 'Keep the opening track.' });
  const removed = toggleCatalogMembership(catalog, 'first', 'one');
  assert.deepEqual(removed.series[0].playlistIds, ['two']);
  const added = toggleCatalogMembership(removed, 'first', 'three');
  assert.deepEqual(added.series[0].playlistIds, ['two', 'three']);
  assert.equal(added.series[1], catalog.series[1]);
  assert.equal(added.selected, catalog.selected);
  assert.equal(added.lead, 'one');
});

test('a new series starts empty without changing existing membership or publication choices', () => {
  const next = appendCatalogSeries(catalog, 'new', 'New compilation');
  assert.deepEqual(next.series[2], {
    id: 'new',
    title: 'New compilation',
    playlistIds: [],
  });
  assert.equal(next.series[0], catalog.series[0]);
  assert.equal(next.order, catalog.order);
  assert.equal(next.selected, catalog.selected);
  assert.equal(next.lead, catalog.lead);
});

test('import appends each new playlist after authored order without changing curation choices', () => {
  const next = appendImportedPlaylistOrder(catalog, [
    'three',
    'new',
    'one',
    'new',
    'last',
  ]);
  assert.deepEqual(next.order, ['one', 'two', 'three', 'new', 'last']);
  assert.equal(next.selected, catalog.selected);
  assert.equal(next.lead, catalog.lead);
  assert.equal(next.series, catalog.series);
  assert.equal(next.notes, catalog.notes);
  assert.deepEqual(catalog.order, ['one', 'two', 'three']);
});

test('an import with no new playlists leaves the saved catalog intact', () => {
  assert.equal(appendImportedPlaylistOrder(catalog, ['three', 'one']), catalog);
  assert.equal(appendImportedPlaylistOrder(catalog, []), catalog);
});
