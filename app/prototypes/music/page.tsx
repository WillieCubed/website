import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import MusicPrototype from '@/components/prototypes/music/MusicPrototype';

export const metadata: Metadata = {
  title: 'Music prototype',
  robots: { index: false, follow: false },
};

export default function MusicPrototypePage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <MusicPrototype />;
}
