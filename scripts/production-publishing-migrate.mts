import { type VercelPoolClient, createPool } from '@vercel/postgres';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

import {
  MIGRATIONS,
  NEON_ORG_ID,
  SCHEMA_QUERY,
  postgresEnvironment,
} from './bootstrap/resources.mjs';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = {
  id: 'icy-sound-09771903',
  name: 'willie-page-indieweb-production',
  region: 'aws-us-west-2',
  host: 'ep-floral-pine-arpatak4-pooler.c-4.us-west-2.aws.neon.tech',
};
const ORIGINAL_FIELDS = [
  'token_hash',
  'client_id',
  'me',
  'scope',
  'issued_at',
  'expires_at',
  'revoked_at',
];
const REQUIRED_MIGRATIONS = [
  'lib/db/migrations/006_indieauth_refresh.sql',
  'lib/db/migrations/007_micropub_deleted_archives.sql',
  'lib/db/migrations/008_atproto_response_observations.sql',
  'lib/db/migrations/009_indieauth_code_replay.sql',
];
const TOKEN_QUERY = `SELECT token_hash, client_id, me, scope,
  issued_at::text AS issued_at, expires_at::text AS expires_at,
  revoked_at::text AS revoked_at FROM public.indieauth_tokens ORDER BY token_hash`;

async function cli(args: string[]): Promise<string> {
  try {
    return (
      await run('neon', args, { timeout: 30000, maxBuffer: 2 * 1024 * 1024 })
    ).stdout;
  } catch {
    throw new Error(
      'The authenticated Neon CLI check failed. No credentials were printed.'
    );
  }
}

function transactionBody(sql: string): string {
  const opening = /^(\s*(?:--[^\n]*(?:\n|$)\s*)*)BEGIN;\s*\n/;
  const closing = /\nCOMMIT;\s*$/;
  assert.equal(
    opening.test(sql),
    closing.test(sql),
    'A migration has an unexpected transaction wrapper.'
  );
  // Keep the four reviewed migrations atomic under the caller's preservation lock.
  return sql.replace(opening, '$1').replace(closing, '\n');
}

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: 'boolean', default: false },
      'acceptance-approved': { type: 'boolean', default: false },
      output: {
        type: 'string',
        default: `.playwright-mcp/production-migration-${Date.now()}`,
      },
    },
  });
  assert(
    !values.apply || values['acceptance-approved'],
    'Applying requires --acceptance-approved after the maintainer reviews all acceptance results and cleanup.'
  );
  const output = resolve(ROOT, values.output!);
  const outputRelative = relative(resolve(ROOT, '.playwright-mcp'), output);
  assert(
    outputRelative &&
      !outputRelative.startsWith('..') &&
      !outputRelative.startsWith('/'),
    'Private receipts must use a new directory inside .playwright-mcp.'
  );
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await mkdir(output, { recursive: false, mode: 0o700 });
  const receiptPath = resolve(output, 'receipt.json');
  const baselinePath = resolve(output, 'private-token-baseline.json');
  assert.deepEqual(
    MIGRATIONS.slice(6),
    REQUIRED_MIGRATIONS,
    'The migration list changed; review the release scope before applying.'
  );

  console.log(
    'Step 1: Verify the exact production Neon project and guarded database host.'
  );
  const list = JSON.parse(
    await cli(['projects', 'list', '--org-id', NEON_ORG_ID, '--output', 'json'])
  );
  const project = (Array.isArray(list) ? list : list.projects).find(
    (entry: { id: string }) => entry.id === PROJECT.id
  );
  assert(
    project &&
      project.name === PROJECT.name &&
      project.region_id === PROJECT.region,
    'The production Neon project identity does not match the reviewed preflight.'
  );
  const connection = (
    await cli([
      'connection-string',
      '--project-id',
      PROJECT.id,
      '--pooled',
      '--ssl',
      'require',
    ])
  ).trim();
  const connectionUrl = new URL(connection);
  const pg = postgresEnvironment(connection);
  assert.equal(
    pg.PGHOST,
    PROJECT.host,
    'The production database host changed.'
  );
  assert.equal(
    pg.PGSSLMODE,
    'require',
    'The production database must require TLS.'
  );
  assert(
    connectionUrl.username &&
      connectionUrl.password &&
      connectionUrl.pathname.length > 1,
    'The production database credentials are incomplete.'
  );
  const migrations = await Promise.all(
    REQUIRED_MIGRATIONS.map(async (path) => ({
      path,
      sql: transactionBody(await readFile(resolve(ROOT, path), 'utf8')),
    }))
  );
  const pool = createPool({ connectionString: connection });
  let client: VercelPoolClient | undefined;
  let transaction = false;
  let committed = false;
  let phase = 'snapshot';
  try {
    client = await pool.connect();
    await client.query(
      values.apply ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
    );
    transaction = true;
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    if (values.apply)
      await client.query(
        'LOCK TABLE public.indieauth_codes, public.indieauth_tokens IN SHARE ROW EXCLUSIVE MODE'
      );
    console.log(
      'Step 2: Save the seven original access-token fields in a private baseline.'
    );
    const before = (await client.query(TOKEN_QUERY)).rows;
    await writeFile(
      baselinePath,
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          projectId: PROJECT.id,
          fields: ORIGINAL_FIELDS,
          rows: before,
        },
        null,
        2
      ) + '\n',
      { mode: 0o600, flag: 'wx' }
    );
    const preSchema =
      (await client.query(SCHEMA_QUERY)).rows[0]?.['?column?'] === true;
    assert(
      (
        await client.query(
          "SELECT to_regclass('public.atproto_oauth_sessions') IS NOT NULL AS present"
        )
      ).rows[0].present,
      'Production migration005 is missing; this helper only applies006–009.'
    );
    if (values.apply) {
      phase = 'migrations';
      console.log(
        'Step 3: Apply only migrations006–009 in the same locked transaction.'
      );
      for (const migration of migrations) await client.query(migration.sql);
    } else {
      console.log(
        'Step 3: Inspect schema readiness without applying migrations.'
      );
    }
    phase = 'preservation';
    const after = (await client.query(TOKEN_QUERY)).rows;
    assert.deepEqual(
      after,
      before,
      'The original access-token fields changed; all migration writes will roll back.'
    );
    const schemaReady =
      (await client.query(SCHEMA_QUERY)).rows[0]?.['?column?'] === true;
    if (values.apply)
      assert(
        schemaReady,
        'The complete publishing schema is missing; all migration writes will roll back.'
      );
    console.log(
      'Step 4: Confirm exact token-row and expiry preservation and full schema readiness.'
    );
    phase = 'commit';
    await client.query(values.apply ? 'COMMIT' : 'ROLLBACK');
    transaction = false;
    committed = values.apply!;
    phase = 'receipt';
    await writeFile(
      receiptPath,
      JSON.stringify(
        {
          version: 1,
          observedAt: new Date().toISOString(),
          projectId: PROJECT.id,
          mode: values.apply ? 'applied' : 'read-only',
          acceptanceApprovedByOperator:
            values.apply && values['acceptance-approved'],
          applied: values.apply ? REQUIRED_MIGRATIONS : [],
          originalAccessTokenRows: before.length,
          exactOriginalFieldsPreserved: true,
          originalExpiryPreserved: true,
          schemaBeforeReady: preSchema,
          schemaReady,
          privateBaseline: baselinePath,
        },
        null,
        2
      ) + '\n',
      { mode: 0o600, flag: 'wx' }
    );
    console.log(
      values.apply
        ? 'The four migrations committed. Existing token rows and expiry are unchanged.'
        : `Read-only check complete. The schema ${schemaReady ? 'is ready' : 'still requires migrations'}.`
    );
    console.log(`Private receipts: ${output}`);
  } catch {
    if (transaction && client) await client.query('ROLLBACK').catch(() => {});
    await writeFile(
      receiptPath,
      JSON.stringify(
        {
          version: 1,
          observedAt: new Date().toISOString(),
          projectId: PROJECT.id,
          mode: values.apply ? 'apply-failed' : 'read-only-failed',
          phase,
          transactionCommitted: committed
            ? true
            : phase === 'commit' && values.apply
              ? 'unknown'
              : false,
          privateBaseline: baselinePath,
        },
        null,
        2
      ) + '\n',
      { mode: 0o600, flag: 'wx' }
    ).catch(() => {});
    throw new Error(
      `The production ${phase} check failed. Inspect the private baseline and receipt; no credential or row values were printed.`
    );
  } finally {
    client?.release();
    await pool.end();
  }
}

main().catch(() => {
  console.error(
    'Production migration check failed. The helper printed no credentials or token-row values.'
  );
  process.exitCode = 1;
});
