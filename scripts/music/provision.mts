import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { Pool } from 'pg';

// Only explicit project-scoped values are copied; the public site's mode never changes.
const source = process.argv[2];
if (!source) throw new Error('Pass the private production env file.');
const env = parseEnv(await readFile(source, 'utf8'));
if (!env.STUDIO_DATABASE_URL || !env.STUDIO_TOKEN_ENCRYPTION_KEY)
  throw new Error('Private database and encryption key are required.');
const databaseURL = env.STUDIO_DATABASE_URL,
  encryptionKey = env.STUDIO_TOKEN_ENCRYPTION_KEY;
const statePath = process.argv[3];
if (!statePath)
  throw new Error(
    'Pass a private local provisioning state file for safe retries.'
  );
let state: Record<string, string>;
try {
  state = JSON.parse(await readFile(statePath, 'utf8'));
} catch {
  state = {
    reader: randomBytes(32).toString('base64url'),
    refresh: randomBytes(32).toString('base64url'),
    secret: randomBytes(32).toString('base64url'),
  };
  await writeFile(statePath, JSON.stringify(state), {
    mode: 0o600,
    flag: 'wx',
  });
}
const pool = new Pool({ connectionString: env.STUDIO_DATABASE_URL, max: 1 });
try {
  console.log('Step 1: Apply the private and approved-cache schemas.');
  for (const scope of ['private', 'public'])
    await pool.query(
      await readFile(
        new URL(`../../lib/music/migrations/${scope}.sql`, import.meta.url),
        'utf8'
      )
    );
  console.log(
    'Step 2: Give the gallery read access and the refresh service its Music-only grants.'
  );
  for (const [role, key] of [
    ['music_public_reader', 'reader'],
    ['music_refresh_runtime', 'refresh'],
  ]) {
    const exists = (
      await pool.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])
    ).rowCount;
    if (!exists)
      await pool.query(`CREATE ROLE ${role} LOGIN PASSWORD '${state[key]}'`);
    await pool.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  }
  await pool.query(
    'GRANT SELECT ON music_approved_cache TO music_public_reader'
  );
  await pool.query(
    'GRANT SELECT,INSERT,UPDATE ON music_provider_cache,music_approved_cache TO music_refresh_runtime'
  );
  await pool.query(
    'GRANT SELECT,UPDATE ON music_connections TO music_refresh_runtime'
  );
  const connection = (role: string, password: string) => {
    const u = new URL(databaseURL);
    u.username = role;
    u.password = password;
    return u.href;
  };
  state.readerURL = connection('music_public_reader', state.reader);
  state.refreshURL = connection('music_refresh_runtime', state.refresh);
  await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
  console.log('Step 3: Verify the public role cannot read private revisions.');
  const reader = new Pool({ connectionString: state.readerURL, max: 1 });
  try {
    await reader.query('SELECT id FROM music_approved_cache LIMIT 1');
    let denied = false;
    try {
      await reader.query('SELECT id FROM music_revisions LIMIT 1');
    } catch {
      denied = true;
    }
    if (!denied)
      throw new Error('Public role unexpectedly reads private data.');
  } finally {
    await reader.end();
  }
  console.log('Step 4: Configure the production Cloudflare Worker.');
  const workerSecrets = {
    MUSIC_PUBLIC_DATABASE_URL: state.readerURL,
    MUSIC_CACHE_WRITE_DATABASE_URL: state.refreshURL,
    MUSIC_PRIVATE_DATABASE_URL: state.refreshURL,
    MUSIC_TOKEN_ENCRYPTION_KEY: encryptionKey,
    MUSIC_REFRESH_SECRET: state.secret,
  };
  const temporary = await mkdtemp(join(tmpdir(), 'willie-music-secrets-'));
  try {
    const file = join(temporary, 'patch.json');
    await writeFile(
      file,
      JSON.stringify({
        secrets: Object.fromEntries(
          Object.entries(workerSecrets).map(([name, text]) => [
            name,
            { name, type: 'secret_text', text },
          ])
        ),
      }),
      { mode: 0o600, flag: 'wx' }
    );
    const result = spawnSync('pnpm', [
      'exec',
      'cf',
      'workers',
      'secrets',
      'bulk',
      '--worker',
      'willie-page',
      '--file',
      file,
      '--profile',
      process.env.CLOUDFLARE_PROFILE || 'williecubed',
    ]);
    if (result.status !== 0)
      throw new Error(
        'Could not configure Music secrets on the Cloudflare Worker.'
      );
    console.log('willie-page Worker: Music secrets configured.');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  console.log(
    'Step 5: Store the scheduler secret and leave scheduling disabled until the live endpoint passes.'
  );
  for (const args of [
    ['secret', 'set', 'MUSIC_REFRESH_SECRET', '--repo', 'WillieCubed/website'],
    [
      'variable',
      'set',
      'MUSIC_REFRESH_ENABLED',
      '--repo',
      'WillieCubed/website',
      '--body',
      'false',
    ],
  ]) {
    const result = spawnSync('gh', args, {
      input: args[0] === 'secret' ? state.secret : undefined,
      encoding: 'utf8',
    });
    if (result.status !== 0)
      throw new Error('Could not configure the refresh scheduler.');
  }
  console.log('Music provisioning passed. The scheduler remains disabled.');
} finally {
  await pool.end();
}
