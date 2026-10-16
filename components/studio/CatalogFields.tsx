'use client';

import type { CatalogEntry, CatalogProperty } from '@/lib/studio/catalog';

interface FieldProps {
  name: string;
  property: CatalogProperty;
  value: unknown;
  fieldsId: string;
  change: (value: unknown) => void;
}

function fieldOptions(property: CatalogProperty) {
  const options = property.options;
  // Old stored proposals may predate schema validation. Keep their settings editable.
  if (!Array.isArray(options) || options.length === 0) return undefined;
  return options.every(
    (option) =>
      option &&
      typeof option.value === 'string' &&
      typeof option.label === 'string'
  )
    ? options
    : undefined;
}
function fieldLabel(name: string, property: CatalogProperty): string {
  return (
    property.label ||
    name
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/\b[A-Z][a-z]+/g, (word) => word.toLowerCase())
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}
function FieldControl({ name, property, value, fieldsId, change }: FieldProps) {
  const options = fieldOptions(property);
  if (options)
    return (
      <select
        value={String(value ?? options[0].value)}
        onChange={(event) => change(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  const accessible = accessibleField(property, name, fieldsId);
  if (property.type === 'boolean')
    return (
      <input
        {...accessible}
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => change(event.target.checked)}
      />
    );
  if (name === 'alt')
    return (
      <textarea
        {...accessible}
        aria-describedby={
          property.description ? `${fieldsId}-${name}-help` : undefined
        }
        rows={3}
        value={String(value ?? '')}
        onChange={(event) => change(event.target.value)}
      />
    );
  return (
    <input
      {...accessible}
      type={property.type === 'number' ? 'number' : 'text'}
      value={String(value ?? '')}
      onChange={(event) => change(fieldValue(property, event.target.value))}
    />
  );
}
function fieldValue(property: CatalogProperty, value: string): unknown {
  if (property.type !== 'number') return value;
  return value === '' ? undefined : Number(value);
}
function CatalogField(props: FieldProps) {
  const { name, property, fieldsId } = props;
  return (
    <label
      className={`site-field${property.type === 'boolean' ? ' studio-checkbox-field' : ''}`}
    >
      <span>
        {fieldLabel(name, property)}
        {property.required ? ' *' : ''}
      </span>
      <FieldControl {...props} />
      {Boolean(property.description) &&
        !['heading', 'title'].includes(name) && (
          <small id={`${fieldsId}-${name}-help`}>{property.description}</small>
        )}
    </label>
  );
}
/** Native controls for a versioned catalog schema; document attrs stay with the node. */
interface CatalogFieldsProps {
  entry: CatalogEntry;
  props: Record<string, unknown>;
  fieldsId: string;
  onChange: (attrs: Record<string, unknown>) => void;
}

export default function CatalogFields({
  entry,
  props,
  fieldsId,
  onChange,
}: CatalogFieldsProps) {
  return Object.entries(entry.properties).map(([name, property]) => (
    <CatalogField
      key={name}
      name={name}
      property={property}
      value={props[name]}
      fieldsId={fieldsId}
      change={(value) => onChange({ props: { ...props, [name]: value } })}
    />
  ));
}

function accessibleField(
  property: CatalogProperty,
  name: string,
  fieldsId: string
) {
  const descriptionVisible =
    Boolean(property.description) && !['heading', 'title'].includes(name);
  return {
    'aria-required': property.required || undefined,
    'aria-describedby': descriptionVisible
      ? `${fieldsId}-${name}-help`
      : undefined,
  };
}
