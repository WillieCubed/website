import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  nextCityIndex,
  statusEditorReducer,
  statusEditorState,
} from '@/components/status/admin/status-editor-state';

import type { AdminState } from '@/lib/status/admin-state';

const saved = {
  city: 'Las Vegas',
  region: 'Nevada',
  country: 'United States',
  timezone: 'America/Los_Angeles',
  latitude: 36.17,
  longitude: -115.14,
};
const chosen = { ...saved, city: 'Henderson' };
const initial: AdminState = {
  configured: true,
  signedIn: true,
  snapshot: { source: 'manual', location: saved, updatedAt: null },
};

test('a failed location save preserves the editable city and confirmed location', () => {
  let state = statusEditorReducer(statusEditorState(initial), {
    type: 'toggle',
  });
  state = statusEditorReducer(state, {
    type: 'search',
    next: { ...initial, results: [chosen] },
  });
  state = statusEditorReducer(state, { type: 'submitting', city: chosen });
  state = statusEditorReducer(state, {
    type: 'saved',
    ok: false,
    next: { ...initial, message: 'Try again.' },
  });
  state = statusEditorReducer(state, { type: 'settled' });
  assert.equal(state.editing, true);
  assert.equal(state.query, 'Henderson');
  assert.deepEqual(state.chosen, chosen);
  assert.deepEqual(state.saved, saved);
  assert.deepEqual(state.results, [chosen]);
  assert.equal(state.pending, false);
  assert.equal(state.message, 'Try again.');
});

test('typing after a chosen city removes stale suggestions and keyboard selection', () => {
  let state = statusEditorState({
    ...initial,
    editing: true,
    results: [chosen],
  });
  state = statusEditorReducer(state, { type: 'select', index: 0 });
  state = statusEditorReducer(state, { type: 'submitting', city: chosen });
  state = statusEditorReducer(state, { type: 'settled' });
  state = statusEditorReducer(state, { type: 'query', value: 'New York' });
  assert.equal(state.query, 'New York');
  assert.equal(state.dirty, true);
  assert.equal(state.chosen, undefined);
  assert.equal(state.selected, -1);
  assert.deepEqual(state.results, []);
});

test('a confirmed save closes editing and clears the draft without enabling a pending control', () => {
  let state = statusEditorState({
    ...initial,
    editing: true,
    results: [chosen],
  });
  state = statusEditorReducer(state, { type: 'submitting', city: chosen });
  state = statusEditorReducer(state, {
    type: 'saved',
    ok: true,
    next: {
      ...initial,
      snapshot: { source: 'manual', location: chosen, updatedAt: null },
      message: 'City updated.',
    },
  });
  assert.equal(state.editing, false);
  assert.equal(state.pending, true);
  assert.equal(state.query, 'Henderson');
  assert.deepEqual(state.saved, chosen);
  assert.equal(state.chosen, undefined);
  assert.deepEqual(state.results, []);
  assert.equal(state.message, 'Saved');
});

test('city keyboard navigation wraps in both directions from the unselected state', () => {
  assert.equal(nextCityIndex(-1, 3, 'ArrowDown'), 0);
  assert.equal(nextCityIndex(-1, 3, 'ArrowUp'), 2);
  assert.equal(nextCityIndex(2, 3, 'ArrowDown'), 0);
  assert.equal(nextCityIndex(0, 3, 'ArrowUp'), 2);
});
