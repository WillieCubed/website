'use client';

import { useCallback, useState } from 'react';

import SiteLink from '@/components/link/SiteLink';

import { useHydrated } from '@/lib/dom/hydrated';
import type { AdminState } from '@/lib/status/admin-state';
import type { City } from '@/lib/status/location';

import { useStatusEditor } from './useStatusEditor';

const regionLabel = (city?: City) =>
  [city?.region, city?.country === 'United States' ? 'US' : city?.country]
    .filter(Boolean)
    .join(', ');

interface LocationEditorProps {
  initial: AdminState;
  onAccessExpired: (message: string, configured: boolean) => void;
}

function LocationEditor({ initial, onAccessExpired }: LocationEditorProps) {
  const hydrated = useHydrated();
  const {
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
  } = useStatusEditor(initial, onAccessExpired);
  return (
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
              onChange={(event) => changeQuery(event.target.value)}
              onKeyDown={onKeyDown}
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
        hidden={!editing || results.length === 0}
      >
        {results.map((city, index) => (
          <form
            key={`${city.city}:${city.latitude}:${city.longitude}`}
            method="post"
            action="/api/admin/status"
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
  );
}

interface StatusEditorProps {
  initial: AdminState;
}

export default function StatusEditor({ initial }: StatusEditorProps) {
  const [access, setAccess] = useState({
    configured: initial.configured,
    signedIn: initial.signedIn,
  });
  const [message, setMessage] = useState(initial.message || '');
  const onAccessExpired = useCallback(
    (message: string, configured: boolean) => {
      setAccess({ configured, signedIn: false });
      setMessage(message);
    },
    []
  );

  return (
    <>
      <div className="admin-heading">
        <h1>Status</h1>
      </div>
      {!access.configured ? (
        <p>Sign-in is unavailable.</p>
      ) : !access.signedIn ? (
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
        <LocationEditor initial={initial} onAccessExpired={onAccessExpired} />
      )}
    </>
  );
}
