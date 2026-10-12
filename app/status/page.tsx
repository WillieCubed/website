import { Suspense } from 'react';

import DockFooter from '@/components/site/DockFooter';
import TopBar from '@/components/site/TopBar';
import LiveStatus from '@/components/status/LiveStatus';

import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Status',
  description: "Willie's current city, local time, and weather.",
  path: '/status',
});

export default function StatusPage() {
  return (
    <div className="status-page-sheet">
      <DockFooter />
      <TopBar
        column="content"
        crumbs={[{ label: 'Status', href: '/status' }]}
      />
      <main id="main" className="status-expanded">
        <Suspense fallback={<p role="status">Loading status…</p>}>
          <LiveStatus expanded />
        </Suspense>
      </main>
    </div>
  );
}
