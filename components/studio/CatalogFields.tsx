'use client';

import type { CatalogEntry } from '@/lib/studio/catalog';

/** Native controls for a versioned catalog schema; document attrs stay with the node. */
export default function CatalogFields({
  entry,
  props,
  fieldsId,
  onChange,
}: {
  entry: CatalogEntry;
  props: Record<string, unknown>;
  fieldsId: string;
  onChange: (attrs: Record<string, unknown>) => void;
}) {
  return Object.entries(entry.properties).map(([key, property]) => {
    // Old stored proposals may predate schema validation. Fall back to a text
    // control rather than making their settings impossible to open.
    const options =
      Array.isArray(property.options) &&
      property.options.length > 0 &&
      property.options.every(
        (option) =>
          option &&
          typeof option.value === 'string' &&
          typeof option.label === 'string'
      )
        ? property.options
        : undefined;
    return (
      <label
        className={`site-field${property.type === 'boolean' ? ' studio-checkbox-field' : ''}`}
        key={key}
      >
        <span>
          {property.label ||
            key
              .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
              .replace(/[_-]/g, ' ')
              .replace(/\b[A-Z][a-z]+/g, (word) => word.toLowerCase())
              .replace(/^./, (letter) => letter.toUpperCase())}
          {property.required ? ' *' : ''}
        </span>
        {options ? (
          <select
            value={String(props[key] ?? options[0].value)}
            onChange={(event) =>
              onChange({
                props: { ...props, [key]: event.target.value },
              })
            }
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : property.type === 'boolean' ? (
          <input
            type="checkbox"
            aria-required={property.required || undefined}
            aria-describedby={
              property.description && !['heading', 'title'].includes(key)
                ? `${fieldsId}-${key}-help`
                : undefined
            }
            checked={Boolean(props[key])}
            onChange={(event) =>
              onChange({
                props: { ...props, [key]: event.target.checked },
              })
            }
          />
        ) : key === 'alt' ? (
          <textarea
            rows={3}
            aria-required={property.required || undefined}
            aria-describedby={
              property.description ? `${fieldsId}-${key}-help` : undefined
            }
            value={String(props[key] ?? '')}
            onChange={(event) =>
              onChange({
                props: { ...props, [key]: event.target.value },
              })
            }
          />
        ) : (
          <input
            type={property.type === 'number' ? 'number' : 'text'}
            aria-required={property.required || undefined}
            aria-describedby={
              property.description && !['heading', 'title'].includes(key)
                ? `${fieldsId}-${key}-help`
                : undefined
            }
            value={String(props[key] ?? '')}
            onChange={(event) =>
              onChange({
                props: {
                  ...props,
                  [key]:
                    property.type === 'number'
                      ? event.target.value === ''
                        ? undefined
                        : Number(event.target.value)
                      : event.target.value,
                },
              })
            }
          />
        )}
        {property.description && !['heading', 'title'].includes(key) && (
          <small id={`${fieldsId}-${key}-help`}>{property.description}</small>
        )}
      </label>
    );
  });
}
