export const NEON_ORG_ID = 'org-twilight-bonus-94453869';
export const MIGRATIONS = [
  'lib/db/migrations/000_webmentions.sql',
  'lib/db/migrations/001_level4_tables.sql',
  'lib/db/migrations/002_webmention_rate_limits.sql',
  'lib/db/migrations/003_indieauth.sql',
];

export const SCHEMA_QUERY = `SELECT (
  to_regclass('public.webmentions') IS NOT NULL AND
  to_regclass('public.outgoing_webmentions') IS NOT NULL AND
  to_regclass('public.reply_context_cache') IS NOT NULL AND
  to_regclass('public.search_index') IS NOT NULL AND
  to_regclass('public.webmention_rate_limits') IS NOT NULL AND
  to_regclass('public.indieauth_codes') IS NOT NULL AND
  to_regclass('public.indieauth_tokens') IS NOT NULL AND
  to_regclass('public.indieauth_totp_steps') IS NOT NULL AND
  to_regclass('public.indieauth_sign_in_failures') IS NOT NULL AND
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webmentions' AND column_name = 'original_source_hash') AND
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webmentions' AND column_name = 'is_deleted') AND
  EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'set_search_vector')
)`;

export function findNeonProject(result, target) {
  const projects = Array.isArray(result) ? result : result?.projects;
  return projects?.find((project) => project.name === target.neonName) ?? null;
}

export function findBlobConnection(result, target) {
  const stores = Array.isArray(result) ? result : result?.stores;
  const store = stores?.find(
    (item) =>
      item.name === target.blobName &&
      item.type === 'blob' &&
      item.status === 'available'
  );
  return (
    store?.connections?.find(
      (connection) =>
        connection.project?.id === target.projectId &&
        connection.environments?.includes('production') &&
        (connection.environmentVariables?.includes('BLOB_STORE_ID') ||
          connection.environmentVariables?.includes('BLOB_READ_WRITE_TOKEN'))
    ) ?? null
  );
}

export function schemaReady(output) {
  return output.trim() === 't';
}

export function postgresEnvironment(connectionString, base = process.env) {
  const url = new URL(connectionString.trim());
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('Neon did not return a PostgreSQL connection string');
  }
  return {
    ...base,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get('sslmode') || 'require',
  };
}

export function ensureDatabase(target, doctor, run) {
  const projects = run('neon', [
    'projects',
    'list',
    '--org-id',
    NEON_ORG_ID,
    '--output',
    'json',
  ]);
  if (!projects.ok)
    return { ok: false, reason: 'could not list Neon projects' };
  let project;
  try {
    project = findNeonProject(JSON.parse(projects.stdout), target);
  } catch {
    return { ok: false, reason: 'Neon returned an unexpected project list' };
  }
  let changed = false;
  if (!project) {
    if (doctor)
      return { ok: false, reason: `${target.neonName} is missing in Neon` };
    const created = run('neon', [
      'projects',
      'create',
      '--name',
      target.neonName,
      '--region-id',
      target.neonRegion,
      '--org-id',
      NEON_ORG_ID,
      '--no-secrets',
      '--output',
      'json',
    ]);
    if (!created.ok)
      return { ok: false, reason: 'could not create the Neon project' };
    try {
      project =
        JSON.parse(created.stdout).project ?? JSON.parse(created.stdout);
    } catch {
      return {
        ok: false,
        reason: 'Neon created a project but did not return its ID',
      };
    }
    changed = true;
  }
  if (!project?.id) return { ok: false, reason: 'Neon project has no ID' };
  const connection = run('neon', [
    'connection-string',
    '--project-id',
    project.id,
    '--pooled',
    '--ssl',
    'require',
  ]);
  if (!connection.ok)
    return { ok: false, reason: 'could not get the Neon connection string' };
  let env;
  try {
    env = postgresEnvironment(connection.stdout);
  } catch {
    return { ok: false, reason: 'Neon returned an invalid connection string' };
  }
  const ready = () => {
    const result = run(
      'psql',
      ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', SCHEMA_QUERY],
      { env }
    );
    return result.ok && schemaReady(result.stdout);
  };
  if (!ready()) {
    if (doctor)
      return { ok: false, reason: 'IndieWeb database migrations are missing' };
    for (const migration of MIGRATIONS) {
      const result = run(
        'psql',
        ['-X', '-v', 'ON_ERROR_STOP=1', '-f', migration],
        { env }
      );
      if (!result.ok)
        return { ok: false, reason: `migration ${migration} failed` };
    }
    if (!ready())
      return {
        ok: false,
        reason: 'database migrations did not produce the required schema',
      };
    changed = true;
  }
  return {
    ok: true,
    changed,
    projectId: project.id,
    connectionString: connection.stdout.trim(),
  };
}

export function ensureBlob(target, doctor, run) {
  const args = [
    'storage',
    'status',
    '--project',
    target.projectId,
    '--json',
    '--scope',
    'williecubed-projects',
  ];
  const inspect = () => {
    const result = run('vercel', args);
    if (!result.ok) return { error: 'could not inspect Vercel storage' };
    try {
      return {
        connection: findBlobConnection(JSON.parse(result.stdout), target),
      };
    } catch {
      return { error: 'Vercel returned an unexpected storage status' };
    }
  };
  const first = inspect();
  if (first.error) return { ok: false, reason: first.error };
  if (first.connection) return { ok: true, changed: false };
  if (doctor)
    return {
      ok: false,
      reason: `${target.blobName} is not connected to ${target.projectName} production`,
    };
  const listed = run('vercel', [
    'storage',
    'list',
    '--json',
    '--scope',
    'williecubed-projects',
  ]);
  if (!listed.ok) return { ok: false, reason: 'could not list Vercel storage' };
  let store;
  try {
    store = JSON.parse(listed.stdout).stores?.find(
      (item) => item.name === target.blobName && item.type === 'blob'
    );
  } catch {
    return { ok: false, reason: 'Vercel returned an unexpected storage list' };
  }
  if (!store) {
    const created = run('vercel', [
      'storage',
      'create',
      target.blobName,
      '--type',
      'blob',
      '--access',
      'public',
      '--json',
      '--scope',
      'williecubed-projects',
    ]);
    if (!created.ok)
      return { ok: false, reason: 'could not create the public Blob store' };
    try {
      store = JSON.parse(created.stdout).store ?? JSON.parse(created.stdout);
    } catch {
      return {
        ok: false,
        reason: 'Vercel created a Blob store but did not return its ID',
      };
    }
  }
  if (!store?.id) return { ok: false, reason: 'Blob store has no ID' };
  const connected = run('vercel', [
    'storage',
    'connect',
    store.id,
    '--project',
    target.projectId,
    '--environment',
    'production',
    '--auth',
    'oidc',
    '--yes',
    '--scope',
    'williecubed-projects',
  ]);
  if (!connected.ok)
    return { ok: false, reason: 'could not connect the Blob store' };
  const last = inspect();
  return last.connection
    ? { ok: true, changed: true }
    : { ok: false, reason: last.error ?? 'Blob connection is still missing' };
}

export function liveDeployment(target, run) {
  const branch = run('gh', [
    'api',
    `repos/WillieCubed/website/branches/${encodeURIComponent(target.branch)}`,
    '--jq',
    '.commit.sha',
  ]);
  if (!branch.ok || !/^[a-f0-9]{40}$/i.test(branch.stdout.trim())) {
    return {
      ok: false,
      reason: `publishing branch ${target.branch} is missing or unreadable`,
    };
  }
  const fetch = (path) =>
    run('curl', [
      '-fsSL',
      '--max-redirs',
      '0',
      '--max-time',
      '15',
      `${target.origin}${path}`,
    ]);
  const revision = fetch('/api/indieweb/revision');
  if (!revision.ok)
    return { ok: false, reason: `${target.origin} is not serving a revision` };
  let deployed;
  try {
    deployed = JSON.parse(revision.stdout).sha;
  } catch {
    return { ok: false, reason: 'the deployed revision response is invalid' };
  }
  const expected = branch.stdout.trim();
  if (deployed !== expected) {
    return {
      ok: false,
      reason: `the public alias serves ${deployed ?? 'no SHA'} while ${target.branch} is ${expected}`,
    };
  }
  const homepage = fetch('/');
  if (
    !homepage.ok ||
    !homepage.stdout.includes('h-card') ||
    !homepage.stdout.includes('rel="micropub"')
  ) {
    return {
      ok: false,
      reason: 'the public homepage does not expose IndieWeb discovery',
    };
  }
  const config = fetch('/micropub?q=config');
  let micropub;
  try {
    micropub = JSON.parse(config.stdout);
  } catch {
    return {
      ok: false,
      reason: 'the public Micropub configuration is invalid',
    };
  }
  if (
    !config.ok ||
    micropub['media-endpoint'] !== `${target.origin}/micropub/media`
  ) {
    return {
      ok: false,
      reason: 'the public Micropub media endpoint is missing or wrong',
    };
  }
  const feed = fetch('/writings/feed.xml');
  if (
    !feed.ok ||
    !feed.stdout.includes('<rss') ||
    !feed.stdout.includes(target.origin)
  ) {
    return {
      ok: false,
      reason: 'the public writings feed is missing or has the wrong origin',
    };
  }
  const metadata = fetch('/.well-known/oauth-authorization-server');
  let auth;
  try {
    auth = JSON.parse(metadata.stdout);
  } catch {
    return { ok: false, reason: 'the public IndieAuth metadata is invalid' };
  }
  if (
    !metadata.ok ||
    auth.issuer !== `${target.origin}/` ||
    !auth.token_endpoint?.startsWith(`${target.origin}/`)
  ) {
    return {
      ok: false,
      reason: 'the public IndieAuth metadata has the wrong origin',
    };
  }
  return { ok: true, revision: expected };
}

export function ensurePublishingBranch(target, doctor, run) {
  const branchPath = `repos/WillieCubed/website/branches/${encodeURIComponent(target.branch)}`;
  const existing = run('gh', ['api', branchPath, '--jq', '.commit.sha']);
  if (existing.ok && /^[a-f0-9]{40}$/i.test(existing.stdout.trim())) {
    return { ok: true, changed: false };
  }
  if (doctor || target.branch === 'main') {
    return {
      ok: false,
      reason: `publishing branch ${target.branch} is missing`,
    };
  }
  const main = run('gh', [
    'api',
    'repos/WillieCubed/website/git/ref/heads/main',
    '--jq',
    '.object.sha',
  ]);
  if (!main.ok || !/^[a-f0-9]{40}$/i.test(main.stdout.trim())) {
    return {
      ok: false,
      reason: 'could not read main before creating the publishing branch',
    };
  }
  const created = run('gh', [
    'api',
    'repos/WillieCubed/website/git/refs',
    '-f',
    `ref=refs/heads/${target.branch}`,
    '-f',
    `sha=${main.stdout.trim()}`,
  ]);
  return created.ok
    ? { ok: true, changed: true }
    : {
        ok: false,
        reason: `could not create publishing branch ${target.branch}`,
      };
}
