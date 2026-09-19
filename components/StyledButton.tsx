'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

export default function StyledBackButton({
  children,
}: React.PropsWithChildren) {
  const router = useRouter();
  return (
    <button
      className="inline-block border-4 border-on-surface bg-primary p-[12px] font-display text-xl font-semibold text-on-primary transition hover:shadow-xl"
      onClick={() => router.back()}
    >
      {children}
    </button>
  );
}
