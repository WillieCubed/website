import type { AdminState } from '@/lib/status/admin-state';
import type { City } from '@/lib/status/location';

export interface StatusEditorState {
  saved: City | undefined;
  editing: boolean;
  query: string;
  dirty: boolean;
  results: City[];
  message: string;
  pending: boolean;
  chosen: City | undefined;
  selected: number;
}

export function statusEditorState(initial: AdminState): StatusEditorState {
  return {
    saved: initial.snapshot?.location,
    editing: Boolean(initial.editing),
    query: initial.query ?? initial.snapshot?.location.city ?? '',
    dirty: false,
    results: initial.results ?? [],
    message: initial.message || '',
    pending: false,
    chosen: undefined,
    selected: -1,
  };
}

export type StatusEditorAction =
  | { type: 'toggle' }
  | { type: 'query'; value: string }
  | { type: 'select'; index: number }
  | { type: 'message'; value: string }
  | { type: 'search'; next: AdminState }
  | { type: 'submitting'; city?: City }
  | { type: 'saved'; next: AdminState; ok: boolean }
  | { type: 'settled' };

/** Form transitions keep draft selection, confirmed location and request state together. */
export function statusEditorReducer(
  state: StatusEditorState,
  action: StatusEditorAction
): StatusEditorState {
  switch (action.type) {
    case 'toggle':
      return toggledStatus(state);
    case 'query':
      return {
        ...state,
        query: action.value,
        dirty: true,
        chosen: undefined,
        results: [],
        selected: -1,
        message: '',
      };
    case 'select':
      return { ...state, selected: action.index };
    case 'message':
      return { ...state, message: action.value };
    case 'search':
      return searchedStatus(state, action.next);
    case 'submitting':
      return submittingStatus(state, action.city);
    case 'saved':
      return savedStatus(state, action.next, action.ok);
    case 'settled':
      return { ...state, pending: false };
  }
}

function savedStatus(
  state: StatusEditorState,
  next: AdminState,
  ok: boolean
): StatusEditorState {
  const confirmed = {
    ...state,
    saved: next.snapshot?.location,
    message: next.message === 'City updated.' ? 'Saved' : next.message || '',
  };
  return ok
    ? {
        ...confirmed,
        editing: false,
        results: [],
        chosen: undefined,
        query: next.snapshot?.location.city || '',
      }
    : { ...confirmed, results: next.results || state.results };
}

function searchedStatus(
  state: StatusEditorState,
  next: AdminState
): StatusEditorState {
  return {
    ...state,
    results: next.results || [],
    message:
      next.message ||
      ((next.results?.length ?? 0) > 0 ? '' : 'No cities found.'),
  };
}
function submittingStatus(
  state: StatusEditorState,
  city: City | undefined
): StatusEditorState {
  return {
    ...state,
    pending: true,
    dirty: false,
    chosen: city,
    query: city ? city.city : state.query,
    message: city ? 'Saving…' : '',
  };
}
export function nextCityIndex(
  selected: number,
  count: number,
  key: string
): number {
  if (selected < 0) return key === 'ArrowDown' ? 0 : count - 1;
  return (selected + (key === 'ArrowDown' ? 1 : -1) + count) % count;
}

function toggledStatus(state: StatusEditorState): StatusEditorState {
  return {
    ...state,
    editing: !state.editing,
    dirty: false,
    query: state.saved?.city || '',
    chosen: undefined,
    results: [],
    selected: -1,
    message: '',
  };
}
