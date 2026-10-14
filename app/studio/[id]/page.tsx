import { connection } from 'next/server';
import { Suspense } from 'react';

import StudioEditor from '@/components/studio/StudioEditor';
import '@/components/studio/studio.css';

export const metadata = {
  title: 'Writing studio',
  robots: { index: false, follow: false },
};
async function Writing({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  return <StudioEditor id={id} />;
}
export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Opening your writing…</p>}>
      <Writing {...props} />
    </Suspense>
  );
}
