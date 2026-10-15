'use client';

import { useEffect, useRef, useState } from 'react';

import SiteLink from '@/components/link/SiteLink';

import { useHydrated } from '@/lib/dom/hydrated';
import { fetchWithDeadline } from '@/lib/http/fetch';
import type { AdminState } from '@/lib/status/admin-state';
import type { City } from '@/lib/status/location';

const endpoint = '/api/admin/status';
const regionLabel = (city?: City) =>
  [city?.region, city?.country === 'United States' ? 'US' : city?.country]
    .filter(Boolean)
    .join(', ');

async function readResponse(
  response: Response
): Promise<AdminState & { redirect?: string }> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || 'Request failed. Try again.');
  }
}

export default function StatusEditor({ initial }: { initial: AdminState }) {
  const [state, setState] = useState(initial);
  const hydrated = useHydrated();
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
  const saved = state.snapshot?.location;

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
        if (current !== sequence.current) return;
        if (!next.signedIn) {
          setState(next);
          setMessage(next.message || 'Sign in again to edit your location.');
          return;
        }
        if (!response.ok) throw new Error('Search is unavailable. Try again.');
        setResults(next.results || []);
        setMessage(
          next.message || (next.results?.length ? '' : 'No cities found.')
        );
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
      setState(next);
      setMessage(
        next.message === 'City updated.' ? 'Saved' : next.message || ''
      );
      if (response.ok) {
        setEditing(false);
        setResults([]);
        setChosen(undefined);
        setQuery(next.snapshot?.location.city || '');
        control.current?.focus();
      } else if (next.signedIn) {
        setResults(next.results || results);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not save. Try again.'
      );
    } finally {
      setPending(false);
    }
  }

  function save(city: City) {
    return submit({ action: 'save', city: JSON.stringify(city) }, city);
  }
  const region =
    chosen ||
    (query.trim().toLowerCase() === saved?.city.toLowerCase() || !editing
      ? saved
      : undefined);

  return (
    <>
      <div className="admin-heading">
        <h1>Status</h1>
      </div>
      {!state.configured ? (
        <p>Sign-in is unavailable.</p>
      ) : !state.signedIn ? (
        <>
          {message && (
            <p className="message" role="status">
              {message}
            </p>
          )}
          <p>
            <SiteLink href="https://willie.page/admin/status" preview={false}>
              Sign in through Cloudflare Access
            </SiteLink>
          </p>
        </>
      ) : (
        <section
          className="editor"
          aria-labelledby="location-title"
          data-location-editor
          data-editing={editing}
        >
          <header className="field-heading">
            <h2 id="location-title">Location</h2>
            <form action="/admin/status" method="get">
              <button
                type="submit"
                name="edit"
                value={editing ? '' : '1'}
                ref={control}
                className="edit-control"
                data-edit-button
                aria-controls="city-field"
                disabled={pending}
                onClick={(event) => {
                  if (hydrated) {
                    event.preventDefault();
                    toggleEdit();
                  }
                }}
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </form>
          </header>
          <div className="location" role="region" aria-label="Current city">
            {!editing ? (
              <p className="city" data-city-display>
                {saved?.city}
              </p>
            ) : (
              <form
                data-location-form
                action="/admin/status"
                method="get"
                onSubmit={(event) => {
                  if (hydrated) event.preventDefault();
                }}
              >
                <input type="hidden" name="edit" value="1" />
                <input
                  ref={input}
                  id="city-field"
                  className="city-input"
                  role="combobox"
                  aria-label="City"
                  aria-autocomplete="list"
                  aria-controls="city-results"
                  aria-expanded={results.length > 0}
                  aria-activedescendant={
                    selected >= 0 ? `city-option-${selected}` : undefined
                  }
                  autoComplete="off"
                  name="q"
                  value={query}
                  maxLength={100}
                  disabled={pending}
                  data-city-input
                  onChange={(event) => {
                    sequence.current++;
                    setQuery(event.target.value);
                    setDirty(true);
                    setChosen(undefined);
                    setResults([]);
                    setSelected(-1);
                    setMessage('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      toggleEdit();
                    } else if (event.key === 'Enter' && selected >= 0) {
                      event.preventDefault();
                      void save(results[selected]);
                    } else if (
                      ['ArrowDown', 'ArrowUp'].includes(event.key) &&
                      results.length
                    ) {
                      event.preventDefault();
                      setSelected(
                        selected < 0
                          ? event.key === 'ArrowDown'
                            ? 0
                            : results.length - 1
                          : (selected +
                              (event.key === 'ArrowDown' ? 1 : -1) +
                              results.length) %
                              results.length
                      );
                    }
                  }}
                />
                <noscript>
                  <button type="submit">Search cities</button>
                </noscript>
              </form>
            )}
            {region && <p className="region">{regionLabel(region)}</p>}
          </div>
          {message && (
            <p className="message" role="status" data-city-status>
              {message}
            </p>
          )}
          <div
            id="city-results"
            className="results"
            role="listbox"
            aria-label="Cities"
            aria-busy={pending}
            hidden={!editing || !results.length}
          >
            {results.map((city, index) => (
              <form
                key={`${city.city}:${city.latitude}:${city.longitude}`}
                method="post"
                action={endpoint}
                onSubmit={(event) => {
                  if (hydrated) {
                    event.preventDefault();
                    void save(city);
                  }
                }}
              >
                <input type="hidden" name="action" value="save" />
                <input type="hidden" name="city" value={JSON.stringify(city)} />
                <button
                  type="submit"
                  role="option"
                  aria-selected={index === selected}
                  id={`city-option-${index}`}
                  disabled={pending}
                >
                  <strong>{city.city}</strong>
                  <span>{regionLabel(city)}</span>
                </button>
              </form>
            ))}
          </div>
          <a className="credit" href="https://open-meteo.com/">
            Open-Meteo
          </a>
        </section>
      )}
    </>
  );
}
