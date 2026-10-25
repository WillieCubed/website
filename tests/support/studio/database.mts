import { userInfo } from 'node:os';
import type { PoolConfig } from 'pg';

export function studioTestDatabase(schema: string, baseUrl?: string) {
  const admin: PoolConfig = baseUrl
    ? { connectionString: baseUrl }
    : { host: '/tmp', database: 'postgres' };
  const application = new URL(baseUrl ?? 'postgresql:///postgres');
  if (!baseUrl) {
    application.searchParams.set('host', '/tmp');
    application.searchParams.set('user', userInfo().username);
  }
  const existing = application.searchParams.get('options');
  application.searchParams.set(
    'options',
    [existing, `-c search_path=${schema}`].filter(Boolean).join(' ')
  );
  return { admin, applicationUrl: application.href };
}
