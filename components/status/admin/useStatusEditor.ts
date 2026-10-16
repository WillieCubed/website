'use client';

import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { fetchWithDeadline } from '@/lib/http/fetch';
import type { AdminState } from '@/lib/status/admin-state';
import type { City } from '@/lib/status/location';

interface AdminStatusResponse extends AdminState {
  redirect?: string;
}

const endpoint = '/api/admin/status';
async function readResponse(response: Response): Promise<AdminStatusResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || 'Request failed. Try again.');
  }
}

export function useStatusEditor(
  initial: AdminState,
  onAccessExpired: (message: string, configured: boolean) => void
) {
  const [saved, setSaved] = useState(initial.snapshot?.location);
  const [editing, setEditing] = useState(Boolean(initial.editing));
  const [query, setQuery] = useState(
    initial.query ?? initial.snapshot?.location.city ?? ''
  );
  const [dirty, setDirty] = useState(false);
  const [results, setResults] = useState<City[]>(initial.results ?? []);
  const [message, setMessage] = useState(initial.message || '');
  const [pending, setPending] = useState(false);
  const [chosen, setChosen] = useState<City>();
  const [selected, setSelected] = useState(-1);
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
    const abort = new AbortController();
    const current = ++sequence.current;
    const timer = setTimeout(async () => {
      setMessage('Searching…');
      try {
        const response = await fetchWithDeadline(
          `${endpoint}?edit=1&q=${encodeURIComponent(query.trim())}`,
          { signal: abort.signal, cache: 'no-store' }
        );
        const next = await readResponse(response);
        if (!abort.signal.aborted) receiveSearch(response, next, current);
      } catch (error) {
        if (!abort.signal.aborted && current === sequence.current)
          setMessage(
            error instanceof Error
              ? error.message
              : 'Search is unavailable. Try again.'
          );
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
      sequence.current++;
    };
  }, [editing, dirty, query, pending]);

  function receiveSearch(
    response: Response,
    next: AdminState,
    current: number
  ): void {
    if (current !== sequence.current) return;
    if (!next.signedIn) {
      onAccessExpired(
        next.message || 'Sign in again to edit your location.',
        next.configured
      );
      return;
    }
    if (!response.ok) throw new Error('Search is unavailable. Try again.');
    setResults(next.results || []);
    setMessage(
      next.message ||
        ((next.results?.length ?? 0) > 0 ? '' : 'No cities found.')
    );
  }

  function receiveSave(response: Response, next: AdminState): void {
    if (!next.signedIn) {
      onAccessExpired(
        next.message || 'Sign in again to edit your location.',
        next.configured
      );
      return;
    }
    setSaved(next.snapshot?.location);
    setMessage(next.message === 'City updated.' ? 'Saved' : next.message || '');
    if (response.ok) {
      setEditing(false);
      setResults([]);
      setChosen(undefined);
      setQuery(next.snapshot?.location.city || '');
      returnFocus.current = true;
    } else {
      setResults(next.results || results);
    }
  }

  function toggleEdit() {
    if (pending) return;
    sequence.current++;
    setEditing(!editing);
    setDirty(false);
    setQuery(saved?.city || '');
    setChosen(undefined);
    setResults([]);
    setSelected(-1);
    setMessage('');
    if (editing) control.current?.focus();
  }

  async function submit(fields: Record<string, string>, city?: City) {
    if (pending) return;
    sequence.current++;
    setPending(true);
    setDirty(false);
    setChosen(city);
    if (city) setQuery(city.city);
    setMessage(city ? 'Saving…' : '');
    try {
      let response = await fetchWithDeadline(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(fields),
      });
      let next = await readResponse(response);
      if (next.redirect) {
        const destination = new URL(next.redirect, window.location.origin);
        response = await fetchWithDeadline(`${endpoint}${destination.search}`, {
          cache: 'no-store',
        });
        next = await readResponse(response);
      }
      if (mounted.current) receiveSave(response, next);
    } catch (error) {
      if (!mounted.current) return;
      setMessage(
        error instanceof Error ? error.message : 'Could not save. Try again.'
      );
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  function save(city: City) {
    return submit({ action: 'save', city: JSON.stringify(city) }, city);
  }
  const region = locationForLabel(chosen, saved, query, editing);

  function changeQuery(value: string): void {
    sequence.current++;
    setQuery(value);
    setDirty(true);
    setChosen(undefined);
    setResults([]);
    setSelected(-1);
    setMessage('');
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
      setSelected(
        selected < 0
          ? event.key === 'ArrowDown'
            ? 0
            : results.length - 1
          : (selected + (event.key === 'ArrowDown' ? 1 : -1) + results.length) %
              results.length
      );
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
