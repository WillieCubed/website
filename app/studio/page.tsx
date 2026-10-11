import { connection } from 'next/server';
import { Suspense } from 'react';

import StudioLibrary from '@/components/studio/StudioLibrary';

import './studio.css';

export const metadata = {
  title: 'Writing studio',
  robots: { index: false, follow: false },
};
async function Library() {
  await connection();
  return <StudioLibrary />;
}
export default function Page() {
  return (
    <Suspense fallback={<p>Opening your writing studio…</p>}>
      <Library />
    </Suspense>
  );
}
