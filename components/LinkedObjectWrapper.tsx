import Link from 'next/link';
import { PropsWithChildren } from 'react';

interface LinkedObjectWrapperProps {
  href: string;
}

export default function LinkedObjectWrapper({
  href,
  children,
}: PropsWithChildren<LinkedObjectWrapperProps>) {
  return (
    <Link
      href={href}
      className="inline-flex flex-col items-start gap-x-md px-lg py-sm bordered bg-maverick-300 dark:bg-maverick-800 hover:dark:bg-maverick-700 focus:dark:bg-maverick-700 transition ease-in duration-100 "
    >
      {children}
    </Link>
  );
}
