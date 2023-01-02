'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

export default function StyledBackButton({
  children,
}: React.PropsWithChildren) {
  const router = useRouter();
  return (
    <button
      className="inline-block p-[12px] border-black border-4 font-semibold font-display text-xl hover:shadow-xl transition bg-primary-dark-2 text-white"
      onClick={() => router.back()}
    >
      {children}
    </button>
  );
}
