import type { ComponentProps } from 'react';

import './site.css';
import './styles/buttons.css';

/** Site controls share typography, hit area, focus and state treatment. */
interface ButtonProps extends ComponentProps<'button'> {
  variant?: 'surface' | 'outlined' | 'tonal' | 'primary' | 'quiet';
  iconOnly?: boolean;
  size?: 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large';
}

export default function Button({
  variant = 'surface',
  iconOnly = false,
  className = '',
  size,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      data-control-size={size}
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
    >
      {size === 'extra-small' || size === 'small' ? (
        <span className="site-control__surface">{children}</span>
      ) : (
        children
      )}
    </button>
  );
}
