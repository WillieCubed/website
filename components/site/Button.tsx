import type { ComponentProps } from 'react';

import './site.css';
import './styles/buttons.css';

/** Site controls share typography, hit area, focus and state treatment. */
interface ButtonProps extends ComponentProps<'button'> {
  variant?: 'surface' | 'outlined' | 'tonal' | 'primary' | 'quiet';
  iconOnly?: boolean;
}

export default function Button({
  variant = 'surface',
  iconOnly = false,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={Array.from(
        new Set([
          'site-button',
          'site-control',
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
