import clsx from 'clsx';
import { PropsWithChildren } from 'react';

import SiteLink from '@/components/link/SiteLink';

interface LinkedObjectWrapperProps {
  href: string;
  openInNewTab?: boolean;
  className?: string;
}

export default function LinkedObjectWrapper({
  href,
  openInNewTab,
  className,
  children,
}: PropsWithChildren<LinkedObjectWrapperProps>) {
  return (
    <SiteLink
      preview={false}
      href={href}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      className={clsx(
        'bordered inline-flex flex-col items-start gap-x-md bg-primary-container px-lg py-sm text-on-primary-container transition duration-150 ease-out hover:bg-primary hover:text-on-primary focus:bg-primary focus:text-on-primary',
        className
      )}
    >
      {children}
    </SiteLink>
  );
}
