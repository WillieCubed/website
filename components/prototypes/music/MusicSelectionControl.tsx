import type { InputHTMLAttributes } from 'react';

import './music-selection-control.css';

export default function MusicSelectionControl({
  type = 'checkbox',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  type?: 'checkbox' | 'radio';
}) {
  return (
    <span className="mp-selection-control" data-kind={type}>
      <input {...props} type={type} />
      <span className="mp-selection-state" aria-hidden="true">
        <span className="mp-selection-icon">
          {type === 'checkbox' && (
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
    </span>
  );
}
