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

import {
  checkDeployment,
  parseEnvNames,
  parseProjectName,
} from '../../scripts/bootstrap/readiness.mjs';

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

test('project selection rejects unknown or malformed Vercel links', () => {
  assert.equal(parseProjectName('{"projectName":"website"}'), 'website');
  assert.equal(
    parseProjectName('{"projectName":"indieweb-acceptance"}'),
    'indieweb-acceptance'
  );
  assert.equal(parseProjectName('{"projectName":"other"}'), null);
  assert.equal(parseProjectName('{'), null);
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
