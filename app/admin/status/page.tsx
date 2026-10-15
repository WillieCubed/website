import type { Metadata } from 'next';
import { headers } from 'next/headers';

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

async function Editor(query: string) {
  const incoming = await headers();
  const response = await statusAdmin(
    new Request(new URL('/api/admin/status' + query, site.origin), {
      headers: {
        'Cf-Access-Jwt-Assertion':
          incoming.get('cf-access-jwt-assertion') || '',
      },
    })
  );
  const state: AdminState = await response.json();
  return <StatusEditor initial={state} />;
}

export default async function StatusAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  ).toString();
  const editor = await Editor(query ? '?' + query : '');
  return (
    <>
      <TopBar
        column="content"
        crumbs={[{ label: 'Status admin', href: '/admin/status' }]}
      />
      <main id="main" className={`status-admin mx-auto ${COLUMN.content}`}>
        {editor}
      </main>
    </>
  );
}
