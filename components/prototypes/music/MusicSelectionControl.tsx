import type { InputHTMLAttributes } from 'react';

import './music-selection-control.css';

export default function MusicSelectionControl({
  type = 'checkbox',
  selectedLabel,
  unselectedLabel,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  type?: 'checkbox' | 'radio';
  selectedLabel?: string;
  unselectedLabel?: string;
}) {
  return (
    <span
      className="mp-selection-control"
      data-labeled={!!selectedLabel || undefined}
    >
      <input {...props} type={type} />
      <span className="mp-selection-state" aria-hidden="true">
        {selectedLabel ? (
          props.checked ? (
            selectedLabel
          ) : (
            unselectedLabel
          )
        ) : (
          <svg viewBox="0 0 18 18" fill="none">
            <path
              d="m3 9 4 4 8-8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </span>
  );
}
