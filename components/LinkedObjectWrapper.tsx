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
        'inline-flex flex-col items-start gap-x-md px-lg py-sm bordered bg-maverick-300 hover:bg-maverick-400 focus:bg-maverick-400 dark:bg-maverick-800 hover:dark:bg-maverick-700 focus:dark:bg-maverick-700 transition ease-out duration-150',
        className
      )}
    >
      {children}
    </SiteLink>
  );
}
