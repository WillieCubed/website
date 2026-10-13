import type { InputHTMLAttributes } from 'react';

import './music-selection-control.css';

export default function MusicSelectionControl({
  type = 'checkbox',
  indicator = 'include',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  type?: 'checkbox' | 'radio';
  indicator?: 'include' | 'feature' | 'equal';
}) {
  return (
    <span className="mp-selection-control" data-indicator={indicator}>
      <input {...props} type={type} />
      <span className="mp-selection-state" aria-hidden="true">
        {indicator !== 'feature' && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mp-choice-off"
          >
            <path
              d={
                indicator === 'include'
                  ? 'M12 5v14M5 12h14'
                  : 'M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z'
              }
            />
          </svg>
        )}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mp-choice-on"
        >
          <path d="m5 12 4 4L19 6" />
        </svg>
      </span>
    </span>
  );
}
