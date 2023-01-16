import Link, { LinkProps } from 'next/link';

interface LinkButtonProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>,
    React.RefAttributes<HTMLAnchorElement>,
    LinkProps {
  href: string;
  variant?: 'primary' | 'secondary';
}

/**
 * A custom link button that supports multiple styles.
 */
export default function LinkButton({
  href,
  variant = 'primary',
  children,
  ...linkProps
}: React.PropsWithChildren<LinkButtonProps>) {
  return (
    <Link
      {...linkProps}
      href={href}
      className={`inline-block p-[12px] border-black border-4 font-semibold font-display text-2xl fancy-shadow-hover transition ${
        variant === 'primary'
          ? 'bg-primary-dark-2 text-white'
          : 'bg-secondary-dark-1 text-white'
      }`}
    >
      {children}
    </Link>
  );
}
