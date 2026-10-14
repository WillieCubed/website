import type { ComponentProps } from 'react';

import './site.css';

/** Site controls share typography, hit area, focus and state treatment. */
export default function Button({
  variant = 'surface',
  iconOnly = false,
  className = '',
  ...props
}: ComponentProps<'button'> & {
  variant?: 'surface' | 'outlined' | 'tonal' | 'primary' | 'quiet';
  iconOnly?: boolean;
}) {
  return (
    <button
      {...props}
      className={Array.from(
        new Set([
          'site-button',
          `site-button-${variant}`,
          ...(iconOnly ? ['site-button-icon'] : []),
          ...className.split(' '),
        ])
      )
        .filter(Boolean)
        .join(' ')}
    />
  );
}
