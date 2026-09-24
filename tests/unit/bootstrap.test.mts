import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { ensureVariables } from '../../scripts/bootstrap/configuration.mjs';
import {
  parseArguments,
  selectedPhases,
} from '../../scripts/bootstrap/options.mjs';
import { enrollment } from '../../scripts/bootstrap/owner.mjs';
import {
  checkDeployment,
  parseEnvNames,
  parseProjectName,
} from '../../scripts/bootstrap/readiness.mjs';
import {
  MIGRATIONS,
  ensureBlob,
  ensureDatabase,
  ensurePublishingBranch,
  findBlobConnection,
  findNeonProject,
  liveDeployment,
  schemaReady,
} from '../../scripts/bootstrap/resources.mjs';
import {
  parseProjectLink,
  targetProject,
} from '../../scripts/bootstrap/targets.mjs';

test('preflight reads only environment names and accepts either Blob credential', () => {
  const names = parseEnvNames(
    JSON.stringify({
      envs: [
        { key: 'POSTGRES_URL', value: 'must-never-be-printed' },
        { key: 'BLOB_STORE_ID' },
      ],
    })
  );
  assert.deepEqual([...names].sort(), ['BLOB_STORE_ID', 'POSTGRES_URL']);
  const result = checkDeployment(names, 'indieweb-acceptance');
  assert.ok(result.missing.includes('INDIEAUTH_TOTP_SECRET'));
  assert.ok(!result.missing.includes('BLOB_READ_WRITE_TOKEN'));
  assert.ok(!JSON.stringify(result).includes('must-never-be-printed'));
});

test('production notification secret is pending rather than required', () => {
  const result = checkDeployment(new Set(), 'website');
  assert.ok(!result.missing.includes('INDIEWEB_NOTIFY_SECRET_PRODUCTION'));
  assert.ok(result.pending.includes('INDIEWEB_NOTIFY_SECRET_PRODUCTION'));
});

test('acceptance needs its own origin so permalinks do not point at production', () => {
  const result = checkDeployment(new Set(), 'indieweb-acceptance');
  assert.ok(result.missing.includes('NEXT_PUBLIC_SITE_ORIGIN'));
});

test('project selection rejects unknown or malformed Vercel links', () => {
  assert.equal(parseProjectName('{"projectName":"website"}'), 'website');
  assert.equal(
    parseProjectName('{"projectName":"indieweb-acceptance"}'),
    'indieweb-acceptance'
  );
  assert.equal(parseProjectName('{"projectName":"other"}'), null);
  assert.equal(parseProjectName('{'), null);
});

test('project identity rejects a same-name project in another Vercel team', () => {
  const target = targetProject('website');
  const wrong = parseProjectLink(
    JSON.stringify({
      projectName: 'website',
      projectId: target.projectId,
      orgId: 'team_another',
    })
  );
  assert.equal(wrong?.projectName, 'website');
  assert.equal(target.matches(wrong), false);
  assert.equal(
    target.matches({
      projectName: 'website',
      projectId: target.projectId,
      orgId: target.orgId,
    }),
    true
  );
});

test('a local-only request cannot silently skip its selected deployment phase', () => {
  assert.throws(
    () => parseArguments(['--local-only', '--phase', 'deployment']),
    /cannot run/
  );
  assert.deepEqual(selectedPhases(parseArguments(['--local-only'])), [
    'tools',
    'workspace',
    'env',
  ]);
  assert.throws(() => parseArguments(['--unknown']), /Unknown option/);
});

test('resource checks select the intended Neon project and connected public Blob store', () => {
  const target = targetProject('indieweb-acceptance');
  const neon = findNeonProject(
    {
      projects: [
        { id: 'wrong', name: 'other' },
        { id: 'right', name: target.neonName },
      ],
    },
    target
  );
  assert.equal(neon?.id, 'right');
  const stores = {
    stores: [
      {
        name: target.blobName,
        type: 'blob',
        status: 'available',
        connections: [
          {
            project: { id: 'wrong' },
            environments: ['production'],
            environmentVariables: ['BLOB_STORE_ID'],
          },
          {
            project: { id: target.projectId },
            environments: ['production'],
            environmentVariables: ['BLOB_STORE_ID'],
          },
        ],
      },
    ],
  };
  assert.equal(
    findBlobConnection(stores, target)?.project.id,
    target.projectId
  );
  assert.equal(
    findBlobConnection(
      {
        stores: [
          {
            ...stores.stores[0],
            connections: stores.stores[0].connections.slice(0, 1),
          },
        ],
      },
      target
    ),
    null
  );
});

test('database readiness needs every IndieWeb table and update column', () => {
  assert.equal(schemaReady('t\n'), true);
  assert.equal(schemaReady('f\n'), false);
  assert.equal(schemaReady(''), false);
});

test('deployment readiness rejects a public alias serving an older revision', () => {
  const target = targetProject('indieweb-acceptance');
  const oldSha = 'a'.repeat(40);
  const newSha = 'b'.repeat(40);
  const run = (program: string, args: string[]) => {
    if (program === 'gh') return { ok: true, stdout: `${newSha}\n` };
    if (args.at(-1)?.endsWith('/api/indieweb/revision'))
      return { ok: true, stdout: JSON.stringify({ sha: oldSha }) };
    return { ok: true, stdout: '' };
  };
  const result = liveDeployment(target, run);
  assert.equal(result.ok, false);
  assert.ok(result.reason.includes(oldSha));
  assert.ok(result.reason.includes(newSha));
});

test('deployment readiness rejects a route that returns an unrelated page', () => {
  const target = targetProject('indieweb-acceptance');
  const sha = 'b'.repeat(40);
  const run = (program: string, args: string[]) => {
    if (program === 'gh') return { ok: true, stdout: `${sha}\n` };
    if (args.at(-1)?.endsWith('/api/indieweb/revision'))
      return { ok: true, stdout: JSON.stringify({ sha }) };
    return { ok: true, stdout: '<html>fallback page</html>' };
  };
  assert.match(liveDeployment(target, run).reason, /homepage/);
});

test('authenticator enrollment produces a portable TOTP URI', () => {
  const result = enrollment(
    targetProject('indieweb-acceptance'),
    Buffer.alloc(20)
  );
  assert.equal(result.secret, 'A'.repeat(32));
  const uri = new URL(result.uri);
  assert.equal(uri.protocol, 'otpauth:');
  assert.equal(uri.searchParams.get('secret'), result.secret);
  assert.equal(uri.searchParams.get('digits'), '6');
});

test('bootstrap creates a missing isolated publishing branch from main', () => {
  const target = targetProject('indieweb-acceptance');
  const calls: string[] = [];
  const sha = 'c'.repeat(40);
  const run = (_program: string, args: string[]) => {
    calls.push(args.join(' '));
    if (args[1]?.includes('/branches/')) return { ok: false, stdout: '' };
    if (args[1]?.endsWith('/git/ref/heads/main'))
      return { ok: true, stdout: `${sha}\n` };
    if (args[1]?.endsWith('/git/refs')) return { ok: true, stdout: '{}' };
    throw new Error(args.join(' '));
  };
  assert.deepEqual(ensurePublishingBranch(target, false, run), {
    ok: true,
    changed: true,
  });
  assert.ok(
    calls.some(
      (call) =>
        call.includes(`ref=refs/heads/${target.branch}`) &&
        call.includes(`sha=${sha}`)
    )
  );
});

test('bootstrap applies missing database migrations in numeric order', () => {
  const target = targetProject('indieweb-acceptance');
  const calls: string[] = [];
  let checked = 0;
  const run = (program: string, args: string[]) => {
    calls.push(`${program} ${args.join(' ')}`);
    if (program === 'neon' && args[1] === 'list') {
      return {
        ok: true,
        stdout: JSON.stringify({
          projects: [{ id: 'neon-test', name: target.neonName }],
        }),
      };
    }
    if (program === 'neon')
      return {
        ok: true,
        stdout: 'postgresql://user:password@localhost/test?sslmode=require',
      };
    if (args.includes('-c'))
      return { ok: true, stdout: ++checked === 1 ? 'f\n' : 't\n' };
    return { ok: true, stdout: '' };
  };
  const result = ensureDatabase(target, false, run);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(
    calls
      .filter((call) => call.includes(' -f '))
      .map((call) => call.split(' -f ')[1]),
    MIGRATIONS
  );
});

test('bootstrap connects the matching public Blob store when it exists but is not connected', () => {
  const target = targetProject('indieweb-acceptance');
  let connected = false;
  const calls: string[] = [];
  const run = (_program: string, args: string[]) => {
    calls.push(args.join(' '));
    if (args[1] === 'status') {
      return {
        ok: true,
        stdout: JSON.stringify({
          stores: [
            {
              id: 'store-test',
              name: target.blobName,
              type: 'blob',
              status: 'available',
              connections: connected
                ? [
                    {
                      project: { id: target.projectId },
                      environments: ['production'],
                      environmentVariables: ['BLOB_STORE_ID'],
                    },
                  ]
                : [],
            },
          ],
        }),
      };
    }
    if (args[1] === 'list')
      return {
        ok: true,
        stdout: JSON.stringify({
          stores: [{ id: 'store-test', name: target.blobName, type: 'blob' }],
        }),
      };
    if (args[1] === 'connect') {
      connected = true;
      return { ok: true, stdout: '' };
    }
    throw new Error(`Unexpected command: ${args.join(' ')}`);
  };
  assert.deepEqual(ensureBlob(target, false, run), { ok: true, changed: true });
  assert.equal(
    calls.some((call) => call.includes('storage create')),
    false
  );
  assert.equal(
    calls.some((call) => call.includes('storage connect store-test')),
    true
  );
});

test('deployment setup stops before mutation when owner credentials are missing', () => {
  const calls: string[] = [];
  const result = ensureVariables({
    target: targetProject('indieweb-acceptance'),
    doctor: false,
    names: new Set(['BLOB_STORE_ID']),
    githubSecrets: new Set(),
    connectionString: 'postgresql://u:p@localhost/test',
    values: {},
    run: (program: string) => {
      calls.push(program);
      return { ok: true, stdout: '' };
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /INDIEAUTH_TOTP_SECRET/);
  assert.match(result.reason, /MICROPUB_GITHUB_TOKEN/);
  assert.deepEqual(calls, []);
});

test('deployment setup writes secrets through stdin and pairs the acceptance notification secret', () => {
  const target = targetProject('indieweb-acceptance');
  const names = new Set([
    'BLOB_STORE_ID',
    'POSTGRES_URL',
    'INDIEAUTH_TOTP_SECRET',
    'MICROPUB_GITHUB_TOKEN',
    'WEBMENTION_SECRET',
    'WEBMENTION_MODERATION_SECRET',
    'INDIEAUTH_INTROSPECTION_SECRET',
    'MICROPUB_GITHUB_REPO',
    'MICROPUB_GITHUB_BRANCH',
    'NEXT_PUBLIC_SITE_ORIGIN',
  ]);
  const writes: Array<{ program: string; args: string[]; input?: string }> = [];
  const result = ensureVariables({
    target,
    doctor: false,
    names,
    githubSecrets: new Set(),
    connectionString: 'postgresql://u:p@localhost/test',
    values: {},
    run: (
      program: string,
      args: string[],
      options: { input?: string } = {}
    ) => {
      writes.push({ program, args, input: options.input });
      return { ok: true, stdout: '' };
    },
  });
  assert.equal(result.ok, true);
  const vercel = writes.find((write) => write.program === 'vercel');
  const github = writes.find((write) => write.program === 'gh');
  assert.equal(
    vercel?.args.slice(0, 4).join(' '),
    'env add INDIEWEB_NOTIFY_SECRET production'
  );
  assert.equal(
    github?.args.slice(0, 3).join(' '),
    'secret set INDIEWEB_NOTIFY_SECRET_ACCEPTANCE'
  );
  assert.equal(vercel?.input, github?.input);
  assert.ok(
    !JSON.stringify(writes.map((write) => write.args)).includes(
      vercel?.input ?? 'no secret'
    )
  );
});

test('domain cutover refuses an acceptance checkout before running provider commands', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'willie-cutover-'));
  mkdirSync(join(cwd, '.vercel'));
  writeFileSync(
    join(cwd, '.vercel', 'project.json'),
    '{"projectName":"indieweb-acceptance"}'
  );
  const script = resolve('scripts/cutover-willie-page.sh');
  const result = spawnSync('sh', [script], { cwd, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /production Vercel project/);
  assert.doesNotMatch(result.stdout + result.stderr, /Attach every hostname/);
});

test('domain cutover refuses a same-name project outside the production account', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'willie-cutover-'));
  mkdirSync(join(cwd, '.vercel'));
  writeFileSync(
    join(cwd, '.vercel', 'project.json'),
    JSON.stringify({
      projectName: 'website',
      projectId: 'prj_elsewhere',
      orgId: 'team_elsewhere',
    })
  );
  const result = spawnSync('sh', [resolve('scripts/cutover-willie-page.sh')], {
    cwd,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /production Vercel project/);
  assert.doesNotMatch(result.stdout + result.stderr, /Attach every hostname/);
});

test('workspace checks cannot trigger IndieWeb postbuild notifications', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'willie-bootstrap-'));
  const bin = join(cwd, 'bin');
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'pnpm'),
    '#!/bin/sh\necho "$INDIEWEB_POSTBUILD" >> bootstrap-env.log\n'
  );
  chmodSync(join(bin, 'pnpm'), 0o755);
  const script = resolve('scripts/bootstrap/cold-start.mjs');
  const result = spawnSync('node', [script, '--phase', 'workspace'], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      INDIEWEB_POSTBUILD: '1',
      PATH: `${bin}:${process.env.PATH}`,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(cwd, 'bootstrap-env.log'), 'utf8'), '1\n0\n');
});

test('preflight runs the repository check even when dependencies are present', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'willie-preflight-'));
  const bin = join(cwd, 'bin');
  mkdirSync(bin);
  mkdirSync(join(cwd, 'node_modules', '.pnpm'), { recursive: true });
  writeFileSync(
    join(bin, 'pnpm'),
    '#!/bin/sh\necho "$1" >> preflight-commands.log\n'
  );
  chmodSync(join(bin, 'pnpm'), 0o755);
  const result = spawnSync(
    'node',
    [
      resolve('scripts/bootstrap/cold-start.mjs'),
      '--doctor',
      '--phase',
      'workspace',
    ],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(join(cwd, 'preflight-commands.log'), 'utf8'),
    'check\n'
  );
});
