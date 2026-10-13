import { connection } from 'next/server';
import { Suspense } from 'react';

import MusicAdmin from '@/components/music/MusicAdmin';

export const metadata = {
  title: 'Curate music',
  robots: { index: false, follow: false },
};
async function Admin() {
  await connection();
  return <MusicAdmin />;
}
export default function Page() {
  return (
    <Suspense fallback={<p>Opening your music collection…</p>}>
      <Admin />
    </Suspense>
  );
}
