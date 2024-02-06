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
      className="inline-flex flex-col items-start gap-x-[10px] px-lg py-md bordered"
    >
      {children}
    </Link>
  );
}
