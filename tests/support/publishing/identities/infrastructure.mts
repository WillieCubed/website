import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { DEFAULT_JOURNAL, DOMAIN, IMAGE, ROOT } from './config.mts';
import { privateWrite, save, validate } from './journal.mts';
import { request, verifyIdentity } from './pds.mts';
import { command } from './process.mts';
import { PDS_COMMAND, pause } from './shared.mts';
import {
  assertPdsContainer,
  ownedVolume,
  pdsEnvironment,
  volumeCommand,
} from './storage.mts';
import type { Journal, OwnedTunnel } from './types.mts';
import { deployWorker, proxySource } from './workers.mts';

export async function ensureContainer(journal: Journal, journalPath: string) {
  assert(
    !journal.storage ||
      journal.storage.active ||
      journal.storage.phase === 'rolled-back' ||
      journal.storage.rollbackRequested,
    'Resume the journaled storage migration before restarting the bind container.'
  );
  await ensureDataMarker(journal);
  if (journal.storage?.active) {
    assert(ownedVolume(journal));
    await volumeCommand(
      journal,
      journalPath,
      `import fs from'node:fs';import assert from'node:assert/strict';assert.equal(fs.readFileSync('/pds/.acceptance-owner','utf8'),${JSON.stringify(journal.marker)});`
    );
  } else {
    await mkdir(resolve(journal.data, 'mail'), {
      recursive: true,
      mode: 0o700,
    });
    await privateWrite(
      resolve(journal.data, 'acceptance-smtp.mjs'),
      await readFile(resolve(ROOT, 'tests/fixtures/atproto/smtp.mjs'), 'utf8')
    );
  }
  const envPath = resolve(dirname(journalPath), 'pds.env');
  await privateWrite(
    envPath,
    Object.entries(pdsEnvironment(journal))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n'
  );
  ensureContainerProcess();
  await waitForContainerReady();
  function ensureContainerProcess(): void {
    command('docker', ['info', '--format', '{{.ServerVersion}}']);
    const existing = spawnSync('docker', ['inspect', journal.container], {
      encoding: 'utf8',
    });
    if (existing.status === 0) {
      const container = JSON.parse(existing.stdout)[0];
      assertPdsContainer(journal, container, Boolean(journal.storage?.active));
      if (!container.State.Running)
        command('docker', ['start', journal.container]);
    } else {
      command('docker', [
        'run',
        '-d',
        '--name',
        journal.container,
        '--cpus=1',
        '--memory=1g',
        '--memory-swap=1g',
        '--label',
        `dev.williecubed.website.acceptance=${journal.marker}`,
        '-p',
        `127.0.0.1:${journal.port}:3000`,
        '--mount',
        journal.storage?.active
          ? `type=volume,src=${journal.storage.volume},dst=/pds`
          : `type=bind,src=${journal.data},dst=/pds`,
        '--env-file',
        envPath,
        IMAGE,
        ...PDS_COMMAND,
      ]);
    }
  }
  async function waitForContainerReady(): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const server = await request(
          `http://127.0.0.1:${journal.port}`,
          'com.atproto.server.describeServer'
        );
        assert(
          server.inviteCodeRequired === true &&
            server.availableUserDomains.includes(`.${DOMAIN}`)
        );
        journal.serverVersion = JSON.parse(
          command('docker', [
            'exec',
            journal.container,
            'node',
            '--input-type=module',
            '-e',
            "import fs from 'node:fs';console.log(JSON.stringify(JSON.parse(fs.readFileSync('node_modules/@atproto/pds/package.json','utf8')).version))",
          ])
        );
        const health = await fetch(
          `http://127.0.0.1:${journal.port}/xrpc/_health`,
          { signal: AbortSignal.timeout(10000) }
        );
        assert(health.ok);
        journal.advertisedVersion = (await health.json()).version;
        await save(journalPath, journal);
        return;
      } catch {
        await pause(1000);
      }
    }
    throw new Error('The isolated PDS did not become healthy.');
  }
}
async function ensureDataMarker(journal: Journal): Promise<void> {
  try {
    await stat(resolve(journal.data, '.acceptance-owner'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    assert(
      journal.workers.length === 0 &&
        !journal.tunnel &&
        !journal.publisher.did &&
        !journal.visitor.did,
      'Refuse an unmarked data directory after live resources were created.'
    );
    command('docker', ['info', '--format', '{{.ServerVersion}}']);
    const container = spawnSync('docker', ['inspect', journal.container], {
      encoding: 'utf8',
    });
    assert(
      container.status !== 0 && container.stderr.includes('No such object'),
      'Refuse an existing container without its data marker.'
    );
    let names: string[];
    try {
      names = await readdir(journal.data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await mkdir(journal.data, { mode: 0o700 });
      names = [];
    }
    assert(names.length === 0, 'Refuse an unmarked nonempty data directory.');
    await privateWrite(
      resolve(journal.data, '.acceptance-owner'),
      journal.marker
    );
  }
  assert(
    (await readFile(resolve(journal.data, '.acceptance-owner'), 'utf8')) ===
      journal.marker,
    'The PDS directory is not owned by this journal.'
  );
}
export async function ensureTunnel(journal: Journal, journalPath: string) {
  if (await reuseExistingTunnel()) return;
  const args = [
    'tunnel',
    '--config',
    '/dev/null',
    '--url',
    `http://127.0.0.1:${journal.port}`,
    '--no-autoupdate',
  ];
  const log = resolve(dirname(journalPath), 'tunnel.log');
  const descriptor = openSync(log, 'w', 0o600);
  const child = spawn('cloudflared', args, {
    detached: true,
    stdio: ['ignore', descriptor, descriptor],
  });
  closeSync(descriptor);
  assert(child.pid !== undefined);
  child.unref();
  const commandLine = `cloudflared ${args.join(' ')}`;
  journal.tunnel = { pid: child.pid, upstream: '', command: commandLine };
  await save(journalPath, journal);
  for (let attempt = 0; attempt < 45; attempt++) {
    const text = await readFile(log, 'utf8');
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      journal.tunnel.upstream = match[0];
      await save(journalPath, journal);
      for (let healthAttempt = 0; healthAttempt < 30; healthAttempt++) {
        if (await pdsHealth(journal.tunnel.upstream, journal)) return;
        await pause(1000);
      }
      throw new Error(
        'The new owned tunnel has not exposed the PDS health endpoint.'
      );
    }
    await pause(1000);
  }
  process.kill(child.pid, 'SIGTERM');
  throw new Error('The temporary tunnel did not start.');
  async function reuseExistingTunnel(): Promise<boolean> {
    if (journal.tunnel) {
      const result = spawnSync(
        'ps',
        ['-p', String(journal.tunnel.pid), '-o', 'command='],
        { encoding: 'utf8' }
      );
      if (result.status === 0) {
        assert(
          result.stdout.includes(journal.tunnel.command),
          'Refuse a reused tunnel PID.'
        );
        await observeExistingUpstream(journal.tunnel);
        let healthy = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (await pdsHealth(journal.tunnel.upstream, journal)) {
            healthy = true;
            break;
          }
          await pause(1000);
        }
        if (healthy) return true;
        await stopExpiredTunnel(journal.tunnel);
      }
      (journal.retiredTunnels ??= []).push({
        pid: journal.tunnel.pid,
        stoppedAt: new Date().toISOString(),
      });
      delete journal.tunnel;
      await save(journalPath, journal);
    }

    return false;
  }
  async function observeExistingUpstream(tunnel: OwnedTunnel): Promise<void> {
    for (let attempt = 0; attempt < 45 && !tunnel.upstream; attempt++) {
      const text = await readFile(
        resolve(dirname(journalPath), 'tunnel.log'),
        'utf8'
      );
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        tunnel.upstream = match[0];
        await save(journalPath, journal);
        break;
      }
      await pause(1000);
    }
    assert(
      tunnel.upstream,
      'The journaled tunnel has not announced its upstream.'
    );
  }
  async function stopExpiredTunnel(tunnel: OwnedTunnel): Promise<void> {
    const beforeSignal = spawnSync(
      'ps',
      ['-p', String(tunnel.pid), '-o', 'command='],
      { encoding: 'utf8' }
    );
    let stopped = beforeSignal.status !== 0;
    if (!stopped) {
      assert(
        beforeSignal.stdout.trim() === tunnel.command,
        'Refuse a reused tunnel PID before signaling.'
      );
      // A Quick Tunnel can expire while cloudflared retries its retired tunnel ID.
      process.kill(tunnel.pid, 'SIGTERM');
    }
    for (let attempt = 0; attempt < 20 && !stopped; attempt++) {
      const current = spawnSync(
        'ps',
        ['-p', String(tunnel.pid), '-o', 'stat=,command='],
        { encoding: 'utf8' }
      );
      if (current.status !== 0 || current.stdout.trim().startsWith('Z')) {
        stopped = true;
        break;
      }
      // A terminating process can lose its argv before the PID disappears.
      // No further signal is sent until a fresh invocation verifies ownership.
      await pause(250);
    }
    assert(stopped, 'The expired owned tunnel has not terminated.');
  }
}
async function pdsHealth(origin: string, journal: Journal) {
  try {
    const response = await fetch(`${origin}/xrpc/_health`, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return (
      typeof body.version === 'string' &&
      body.version === journal.advertisedVersion
    );
  } catch {
    return false;
  }
}
export async function repairAcceptanceInfrastructure(
  options: { journalPath?: string } = {}
) {
  const path = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  const journal = JSON.parse(await readFile(path, 'utf8')) as Journal;
  validate(journal, path);
  assert(!journal.cleaned && journal.federation && journal.configured);
  assert(
    journal.publisher.did &&
      journal.visitor.did &&
      journal.publisher.appPassword &&
      journal.visitor.appPassword
  );
  await ensureContainer(journal, path);
  await ensureTunnel(journal, path);
  await deployWorker(
    journal,
    path,
    new URL(journal.origin).hostname.split('.')[0],
    proxySource(journal)
  );
  await verifyCanonicalHealth();
  await verifyCanonicalIssuer();
  for (const account of [journal.publisher, journal.visitor]) {
    await verifyIdentity(journal, account);
    const authenticated = await request(
      journal.origin,
      'com.atproto.server.createSession',
      { identifier: account.did, password: account.appPassword }
    );
    try {
      assert(authenticated.did === account.did);
      const current = await request(
        journal.origin,
        'com.atproto.server.getSession',
        undefined,
        `Bearer ${authenticated.accessJwt}`
      );
      assert(current.did === account.did && current.emailConfirmed === true);
    } finally {
      await request(
        journal.origin,
        'com.atproto.server.deleteSession',
        undefined,
        `Bearer ${authenticated.refreshJwt}`
      );
    }
  }
  journal.repairedAt = new Date().toISOString();
  await save(path, journal);
  return {
    origin: journal.origin,
    checkedAt: journal.repairedAt,
    publisher: journal.publisher.did,
    visitor: journal.visitor.did,
    status: 'passed' as const,
  };
  async function verifyCanonicalHealth(): Promise<void> {
    let healthy = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (await pdsHealth(journal.origin, journal)) {
        healthy = true;
        break;
      }
      await pause(1000);
    }
    assert(healthy, 'The canonical PDS health endpoint did not recover.');
  }
  async function verifyCanonicalIssuer(): Promise<void> {
    let issuerMatches = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const metadata = await fetch(
          `${journal.origin}/.well-known/oauth-authorization-server`,
          { redirect: 'error', signal: AbortSignal.timeout(10000) }
        );
        if (metadata.ok && (await metadata.json()).issuer === journal.origin) {
          issuerMatches = true;
          break;
        }
      } catch {
        // The owned Worker update can reach separate Cloudflare edges at different times.
      }
      await pause(1000);
    }
    assert(issuerMatches, 'The recovered PDS OAuth issuer did not match.');
  }
}
