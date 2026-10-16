'use client';

import { type KeyboardEvent, useEffect, useReducer, useRef } from 'react';

import type { AdminState } from '@/lib/status/admin-state';
import type { City } from '@/lib/status/location';

import { scheduleCitySearch, submitStatus } from './status-editor-requests';
import {
  nextCityIndex,
  statusEditorReducer,
  statusEditorState,
} from './status-editor-state';

export function useStatusEditor(
  initial: AdminState,
  onAccessExpired: (message: string, configured: boolean) => void
) {
  const [state, dispatch] = useReducer(
    statusEditorReducer,
    initial,
    statusEditorState
  );
  const {
    saved,
    editing,
    query,
    dirty,
    results,
    message,
    pending,
    chosen,
    selected,
  } = state;
  const input = useRef<HTMLInputElement>(null);
  const control = useRef<HTMLButtonElement>(null);
  const sequence = useRef(0);
  const returnFocus = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      returnFocus.current = false;
    };
  }, []);

  useEffect(() => {
    // Saving disables the control until the pending render has committed.
    if (!editing && !pending && returnFocus.current) {
      returnFocus.current = false;
      control.current?.focus();
    }
  }, [editing, pending]);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing || !dirty || query.trim().length < 2 || pending) return;
    const current = ++sequence.current;
    const cancel = scheduleCitySearch(
      query,
      (response, next) => {
        if (current === sequence.current) receiveSearch(response, next);
      },
      (value) => {
        if (current === sequence.current) dispatch({ type: 'message', value });
      }
    );
    return () => {
      sequence.current++;
      cancel();
    };
  }, [editing, dirty, query, pending]);

  function receiveSearch(response: Response, next: AdminState): void {
    if (!next.signedIn) {
      onAccessExpired(
        next.message || 'Sign in again to edit your location.',
        next.configured
      );
      return;
    }
    if (!response.ok) throw new Error('Search is unavailable. Try again.');
    dispatch({ type: 'search', next });
  }

  function receiveSave(response: Response, next: AdminState): void {
    if (!next.signedIn) {
      onAccessExpired(
        next.message || 'Sign in again to edit your location.',
        next.configured
      );
      return;
    }
    dispatch({ type: 'saved', next, ok: response.ok });
    if (response.ok) returnFocus.current = true;
  }

  function toggleEdit() {
    if (pending) return;
    sequence.current++;
    dispatch({ type: 'toggle' });
    if (editing) control.current?.focus();
  }

  async function submit(fields: Record<string, string>, city?: City) {
    if (pending) return;
    sequence.current++;
    dispatch({ type: 'submitting', city });
    try {
      const { response, next } = await submitStatus(fields);
      if (mounted.current) receiveSave(response, next);
    } catch (error) {
      if (!mounted.current) return;
      dispatch({
        type: 'message',
        value:
          error instanceof Error ? error.message : 'Could not save. Try again.',
      });
    } finally {
      if (mounted.current) dispatch({ type: 'settled' });
    }
  }

  function save(city: City) {
    return submit({ action: 'save', city: JSON.stringify(city) }, city);
  }
  const region = locationForLabel(chosen, saved, query, editing);

  function changeQuery(value: string): void {
    sequence.current++;
    dispatch({ type: 'query', value });
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      toggleEdit();
    } else if (event.key === 'Enter' && selected >= 0) {
      event.preventDefault();
      void save(results[selected]);
    } else if (
      ['ArrowDown', 'ArrowUp'].includes(event.key) &&
      results.length > 0
    ) {
      event.preventDefault();
      dispatch({
        type: 'select',
        index: nextCityIndex(selected, results.length, event.key),
      });
    }
  }
  return {
    editing,
    query,
    results,
    message,
    pending,
    selected,
    input,
    control,
    saved,
    region,
    toggleEdit,
    save,
    changeQuery,
    onKeyDown,
  };
}

function locationForLabel(
  chosen: City | undefined,
  saved: City | undefined,
  query: string,
  editing: boolean
): City | undefined {
  if (chosen) return chosen;
  if (editing && query.trim().toLowerCase() !== saved?.city.toLowerCase())
    return undefined;
  return saved;
}
