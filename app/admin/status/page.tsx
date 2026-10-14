import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';

import TopBar, { COLUMN } from '@/components/site/TopBar';

import { site } from '@/lib/site/identity';
import { statusAdmin } from '@/lib/status/admin-runtime';
import type { AdminState } from '@/lib/status/admin-state';

import StatusEditor from '../../../components/status/admin/StatusEditor';
import '../../../components/status/admin/status-admin.css';

export const metadata: Metadata = {
  title: 'Status admin',
  robots: { index: false, follow: false },
  referrer: 'same-origin',
};

async function Editor() {
  const incoming = await headers();
  const response = await statusAdmin(
    new Request(new URL('/api/admin/status', site.origin), {
      headers: {
        'Cf-Access-Jwt-Assertion':
          incoming.get('cf-access-jwt-assertion') || '',
      },
    })
  );
  const state: AdminState = await response.json();
  return <StatusEditor initial={state} />;
}

export default function StatusAdminPage() {
  return (
    <>
      <TopBar
        column="content"
        crumbs={[{ label: 'Status admin', href: '/admin/status' }]}
      />
      <main id="main" className={`status-admin mx-auto ${COLUMN.content}`}>
        <Suspense fallback={<h1>Status</h1>}>
          <Editor />
        </Suspense>
      </main>
    </>
  );
}
