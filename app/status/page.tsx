import DockFooter from '@/components/site/DockFooter';
import TopBar, { COLUMN } from '@/components/site/TopBar';
import LiveStatus from '@/components/status/LiveStatus';

import { pageMetadata } from '@/lib/seo/metadata';

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
      <main id="main" className={`status-expanded ${COLUMN.content}`}>
        <LiveStatus expanded />
      </main>
    </div>
  );
}
