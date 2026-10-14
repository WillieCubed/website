import { now } from '@atcute/tid';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createECDH, randomBytes } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual, parseArgs, parseEnv } from 'node:util';

import { isMain } from '../runtime.mts';
import { ACCOUNT, DEFAULT_JOURNAL, DOMAIN, IMAGE, ROOT } from './config.mts';
import { privateWrite, save, validate } from './journal.mts';
import {
  federation,
  provisionAccount,
  readRecord,
  request,
  session,
  verifyIdentity,
} from './pds.mts';
import { command, freePort } from './process.mts';
import { PDS_COMMAND, pause } from './shared.mts';
import {
  assertPdsContainer,
  assertStorageHelper,
  assertVolumeAttachments,
  copyAndVerifyScript,
  inspectedContainer,
  ownedVolume,
  pdsEnvironment,
  recordManifest,
  sourceManifest,
  volumeCommand,
} from './storage.mts';
import type { Journal, OwnedAccount } from './types.mts';
import {
  cloudflare,
  deployWorker,
  handleSource,
  proxySource,
  workerContent,
} from './workers.mts';

export type AcceptanceIdentities = {
  origin: string;
  journalPath: string;
  publisher: OwnedAccount & { did: string; appPassword: string };
  visitor: OwnedAccount & { did: string; appPassword: string };
};
export async function migrateAcceptanceStorage(options: {
  journalPath?: string;
  verificationCleaned: boolean;
}) {
  assert(
    options.verificationCleaned,
    'Complete pending record/grant cleanup before migrating storage.'
  );
  const path = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  const journal = JSON.parse(await readFile(path, 'utf8')) as Journal;
  validate(journal, path);
  assert(
    !journal.cleaned &&
      journal.configured &&
      journal.publisher.did &&
      journal.visitor.did
  );
  assert(
    (await readFile(resolve(journal.data, '.acceptance-owner'), 'utf8')) ===
      journal.marker
  );
  if (!journal.storage) {
    assert(
      !inspectedContainer(`${journal.container}-bind-backup`) &&
        !inspectedContainer(`${journal.container}-volume-backup`)
    );
    journal.storage = {
      volume: `${journal.container}-data`,
      rollbackContainer: `${journal.container}-bind-backup`,
      volumeContainer: `${journal.container}-volume-backup`,
      active: false,
      phase: 'planned',
      helpers: [],
      records: await recordManifest(journal),
    };
    await save(path, journal);
  }
  const storage = journal.storage;
  assert(
    storage.phase !== 'rolled-back',
    'A rolled-back migration requires review before restarting.'
  );
  if (storage.phase === 'verified')
    return {
      status: 'passed',
      volume: storage.volume,
      records: storage.records?.length,
      sqliteChecks: storage.sqliteChecks,
    };
  if (storage.phase === 'planned') {
    const current = inspectedContainer(journal.container);
    assertPdsContainer(journal, current, false);
    if (current.State.Running)
      command('docker', ['stop', '--time', '20', journal.container]);
    assert(!inspectedContainer(journal.container).State.Running);
    storage.manifest = await sourceManifest(journal.data);
    storage.phase = 'stopped';
    await save(path, journal);
  }
  if (storage.phase === 'stopped') {
    assert(
      isDeepStrictEqual(await sourceManifest(journal.data), storage.manifest),
      'The retained source backup changed.'
    );
    const current = inspectedContainer(journal.container);
    assertPdsContainer(journal, current, false);
    assert(!current.State.Running);
    if (!ownedVolume(journal))
      command('docker', [
        'volume',
        'create',
        '--label',
        `dev.williecubed.website.acceptance=${journal.marker}`,
        storage.volume,
      ]);
    assert(ownedVolume(journal));
    const proof = JSON.parse(
      await volumeCommand(
        journal,
        path,
        copyAndVerifyScript(journal),
        journal.data
      )
    );
    storage.sqliteChecks = proof.sqliteChecks;
    storage.phase = 'copied';
    await save(path, journal);
  }
  if (storage.phase === 'copied') {
    assert(
      isDeepStrictEqual(await sourceManifest(journal.data), storage.manifest),
      'The retained source backup changed.'
    );
    const original = inspectedContainer(journal.container),
      backup = inspectedContainer(storage.rollbackContainer);
    if (!backup) {
      assertPdsContainer(journal, original, false);
      assert(!original.State.Running);
      command('docker', [
        'rename',
        journal.container,
        storage.rollbackContainer,
      ]);
    } else {
      assert(!original);
      assertPdsContainer(journal, backup, false);
      assert(!backup.State.Running);
    }
    storage.active = true;
    storage.phase = 'renamed';
    await save(path, journal);
  }
  await repairAcceptanceInfrastructure({ journalPath: path });
  Object.assign(journal, JSON.parse(await readFile(path, 'utf8')));
  assert(
    isDeepStrictEqual(await recordManifest(journal), storage.records),
    'The migrated PDS changed existing record URIs/CIDs.'
  );
  assert(
    isDeepStrictEqual(await sourceManifest(journal.data), storage.manifest),
    'The retained source backup changed.'
  );
  journal.storage!.phase = 'verified';
  await save(path, journal);
  return {
    status: 'passed',
    volume: storage.volume,
    records: storage.records?.length,
    sqliteChecks: storage.sqliteChecks,
  };
}
export async function rollbackAcceptanceStorage(options: {
  journalPath?: string;
  verificationCleaned: boolean;
}) {
  assert(
    options.verificationCleaned,
    'Complete pending record/grant cleanup before rolling back storage.'
  );
  const path = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  const journal = JSON.parse(await readFile(path, 'utf8')) as Journal;
  validate(journal, path);
  const storage = journal.storage;
  assert(storage && !journal.cleaned && storage.manifest && storage.records);
  if (storage.phase === 'rolled-back') {
    await repairAcceptanceInfrastructure({ journalPath: path });
    assert(isDeepStrictEqual(await recordManifest(journal), storage.records));
    return { status: 'passed', storage: 'bind' };
  }
  storage.rollbackRequested = true;
  await save(path, journal);
  const original = inspectedContainer(storage.rollbackContainer);
  const current = inspectedContainer(journal.container);
  if (!original) {
    assertPdsContainer(journal, current, false);
    const retained = inspectedContainer(storage.volumeContainer);
    assertPdsContainer(journal, retained, true);
    assert(!retained.State.Running);
    storage.active = false;
    await save(path, journal);
    await repairAcceptanceInfrastructure({ journalPath: path });
    Object.assign(journal, JSON.parse(await readFile(path, 'utf8')));
    assert(isDeepStrictEqual(await recordManifest(journal), storage.records));
    journal.storage!.phase = 'rolled-back';
    await save(path, journal);
    return { status: 'passed', storage: 'bind' };
  }
  assert(
    isDeepStrictEqual(await sourceManifest(journal.data), storage.manifest),
    'The retained bind backup changed.'
  );
  assertPdsContainer(journal, original, false);
  assert(!original.State.Running);
  if (current) {
    assertPdsContainer(journal, current, true);
    if (current.State.Running) {
      assert(
        isDeepStrictEqual(await recordManifest(journal), storage.records),
        'Refuse rollback after PDS records changed.'
      );
      storage.rollbackRecordsVerified = true;
      await save(path, journal);
      command('docker', ['stop', '--time', '20', journal.container]);
    } else
      assert(
        storage.phase !== 'verified' || storage.rollbackRecordsVerified,
        'Restore health and verify current records before rolling back a used volume.'
      );
    assert(!inspectedContainer(storage.volumeContainer));
    command('docker', ['rename', journal.container, storage.volumeContainer]);
  } else {
    const retained = inspectedContainer(storage.volumeContainer);
    assertPdsContainer(journal, retained, true);
    assert(!retained.State.Running);
  }
  command('docker', ['rename', storage.rollbackContainer, journal.container]);
  storage.active = false;
  await save(path, journal);
  await repairAcceptanceInfrastructure({ journalPath: path });
  Object.assign(journal, JSON.parse(await readFile(path, 'utf8')));
  assert(isDeepStrictEqual(await recordManifest(journal), storage.records));
  journal.storage!.phase = 'rolled-back';
  await save(path, journal);
  return { status: 'passed', storage: 'bind' };
}
async function ensureContainer(journal: Journal, journalPath: string) {
  assert(
    !journal.storage ||
      journal.storage.active ||
      journal.storage.phase === 'rolled-back' ||
      journal.storage.rollbackRequested,
    'Resume the journaled storage migration before restarting the bind container.'
  );
  try {
    await stat(resolve(journal.data, '.acceptance-owner'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    assert(
      !journal.workers.length &&
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
    assert(!names.length, 'Refuse an unmarked nonempty data directory.');
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
async function ensureTunnel(journal: Journal, journalPath: string) {
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
      for (
        let attempt = 0;
        attempt < 45 && !journal.tunnel.upstream;
        attempt++
      ) {
        const text = await readFile(
          resolve(dirname(journalPath), 'tunnel.log'),
          'utf8'
        );
        const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) {
          journal.tunnel.upstream = match[0];
          await save(journalPath, journal);
          break;
        }
        await pause(1000);
      }
      assert(
        journal.tunnel.upstream,
        'The journaled tunnel has not announced its upstream.'
      );
      let healthy = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (await pdsHealth(journal.tunnel.upstream, journal)) {
          healthy = true;
          break;
        }
        await pause(1000);
      }
      if (healthy) return;
      const beforeSignal = spawnSync(
        'ps',
        ['-p', String(journal.tunnel.pid), '-o', 'command='],
        { encoding: 'utf8' }
      );
      let stopped = beforeSignal.status !== 0;
      if (!stopped) {
        assert(
          beforeSignal.stdout.trim() === journal.tunnel.command,
          'Refuse a reused tunnel PID before signaling.'
        );
        // A Quick Tunnel can expire while cloudflared retries its retired tunnel ID.
        process.kill(journal.tunnel.pid, 'SIGTERM');
      }
      for (let attempt = 0; attempt < 20 && !stopped; attempt++) {
        const current = spawnSync(
          'ps',
          ['-p', String(journal.tunnel.pid), '-o', 'stat=,command='],
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
    (journal.retiredTunnels ??= []).push({
      pid: journal.tunnel.pid,
      stoppedAt: new Date().toISOString(),
    });
    delete journal.tunnel;
    await save(journalPath, journal);
  }
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
  assert(child.pid);
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
  let healthy = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await pdsHealth(journal.origin, journal)) {
      healthy = true;
      break;
    }
    await pause(1000);
  }
  assert(healthy, 'The canonical PDS health endpoint did not recover.');
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
}
export async function loadOwnedAcceptanceIdentities(
  journalPath = DEFAULT_JOURNAL,
  expectedPublisherDid?: string
): Promise<AcceptanceIdentities> {
  journalPath = resolve(journalPath);
  const journal = JSON.parse(await readFile(journalPath, 'utf8')) as Journal;
  validate(journal, journalPath);
  assert(journal.federation && !journal.cleaned);
  assert(
    journal.publisher.did &&
      journal.publisher.appPassword &&
      journal.visitor.did &&
      journal.visitor.appPassword
  );
  assert(journal.publisher.did !== journal.visitor.did);
  if (expectedPublisherDid)
    assert(journal.publisher.did === expectedPublisherDid);
  await verifyIdentity(journal, journal.publisher);
  await verifyIdentity(journal, journal.visitor);
  return {
    origin: journal.origin,
    journalPath,
    publisher: journal.publisher as AcceptanceIdentities['publisher'],
    visitor: journal.visitor as AcceptanceIdentities['visitor'],
  };
}
export async function provisionAcceptanceIdentities(
  options: { envPath?: string; journalPath?: string } = {}
): Promise<AcceptanceIdentities> {
  const journalPath = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  let journal: Journal;
  try {
    journal = JSON.parse(await readFile(journalPath, 'utf8'));
    validate(journal, journalPath);
    assert(!journal.cleaned);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    try {
      await stat(resolve(dirname(journalPath), 'pds'));
      throw new Error(
        'Refuse a preexisting PDS directory without an ownership journal.',
        { cause: error }
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const run = randomBytes(5).toString('hex');
    const key = createECDH('secp256k1');
    key.generateKeys();
    journal = {
      version: 1,
      account: ACCOUNT,
      domain: DOMAIN,
      run,
      marker: randomBytes(32).toString('hex'),
      origin: `https://willie-pds-${run}.${DOMAIN}`,
      container: `dev-williecubed-website-pds-${run}`,
      port: await freePort(),
      image: IMAGE,
      data: resolve(dirname(journalPath), 'pds'),
      adminPassword: randomBytes(32).toString('hex'),
      jwtSecret: randomBytes(32).toString('hex'),
      rotationKey: key.getPrivateKey('hex'),
      workers: [],
      publisher: {
        handle: `pub${run}.${DOMAIN}`,
        email: `publisher-${run}@williecubed.dev`,
        password: randomBytes(32).toString('base64url'),
      },
      visitor: {
        handle: `vis${run}.${DOMAIN}`,
        email: `visitor-${run}@williecubed.dev`,
        password: randomBytes(32).toString('base64url'),
      },
      started: new Date().toISOString(),
    };
    await save(journalPath, journal);
    await mkdir(journal.data, { mode: 0o700 });
    await privateWrite(
      resolve(journal.data, '.acceptance-owner'),
      journal.marker
    );
  }
  console.log(
    'Step 1: Start the owned official PDS with a 1 CPU and 1 GiB limit.'
  );
  await ensureContainer(journal, journalPath);
  console.log(
    'Step 2: Publish the owned PDS proxy and handle endpoints on the personal Workers account.'
  );
  await ensureTunnel(journal, journalPath);
  await deployWorker(
    journal,
    journalPath,
    new URL(journal.origin).hostname.split('.')[0],
    proxySource(journal)
  );
  for (const account of [journal.publisher, journal.visitor])
    await deployWorker(
      journal,
      journalPath,
      account.handle.split('.')[0],
      handleSource(journal, account)
    );
  console.log(
    'Step 3: Create two invited accounts and confirm their email through normal provider APIs.'
  );
  for (const account of [journal.publisher, journal.visitor])
    await provisionAccount(journal, journalPath, account);
  const metadata = await fetch(
    `${journal.origin}/.well-known/oauth-authorization-server`,
    { redirect: 'error', signal: AbortSignal.timeout(15000) }
  );
  assert(metadata.ok && (await metadata.json()).issuer === journal.origin);
  console.log(
    'Step 4: Wait for public PLC, relay ingestion, and independent Bluesky AppView reads.'
  );
  await federation(journal, journalPath);
  const envPath = resolve(
    options.envPath ?? resolve(ROOT, '.env.standard-test.local')
  );
  let text = '';
  try {
    text = await readFile(envPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const previous = parseEnv(text);
  const settings = {
    NEXT_PUBLIC_ATPROTO_DID: journal.publisher.did!,
    NEXT_PUBLIC_BLUESKY_HANDLE: journal.publisher.handle,
    ATPROTO_APP_PASSWORD: journal.publisher.appPassword!,
    ATPROTO_PUBLICATION_RKEY:
      previous.NEXT_PUBLIC_ATPROTO_DID === journal.publisher.did &&
      previous.ATPROTO_PUBLICATION_RKEY
        ? previous.ATPROTO_PUBLICATION_RKEY
        : now(),
    NEXT_PUBLIC_SITE_ORIGIN: 'https://indieweb-acceptance.vercel.app',
    ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL: journalPath,
    ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN: journal.origin,
  };
  await privateWrite(
    envPath,
    [
      ...text
        .split('\n')
        .filter(
          (line) =>
            line &&
            !Object.keys(settings).some((name) => line.startsWith(`${name}=`))
        ),
      ...Object.entries(settings).map(
        ([name, value]) => `${name}=${JSON.stringify(value)}`
      ),
    ].join('\n') + '\n'
  );
  console.log('Step 5: Configure only the isolated acceptance Vercel project.');
  for (const [name, value] of Object.entries(settings).filter(
    ([name]) => !name.startsWith('ATPROTO_ACCEPTANCE_')
  ))
    command(
      'vercel',
      [
        'env',
        'add',
        name,
        'production',
        '--project',
        'prj_rurUFlQ4YKYKoMxGCaAyL6ASijHm',
        '--scope',
        'williecubed-projects',
        '--force',
        '--yes',
        ...(name === 'ATPROTO_APP_PASSWORD' ? ['--sensitive'] : []),
      ],
      value + '\n'
    );
  journal.configured = true;
  await save(journalPath, journal);
  await privateWrite(
    resolve(dirname(journalPath), 'evidence.json'),
    JSON.stringify(
      {
        timestamp: journal.federation,
        origin: journal.origin,
        image: journal.image,
        serverVersion: journal.serverVersion,
        advertisedVersion: journal.advertisedVersion,
        accounts: [journal.publisher, journal.visitor].map((account) => ({
          handle: account.handle,
          did: account.did,
          emailConfirmed: account.confirmed,
          publicAppViewPostCid: account.probe?.cid,
          probeRemoved: account.probe?.removed,
        })),
        network: {
          plc: 'https://plc.directory',
          relay: 'https://bsky.network',
          appView: 'https://public.api.bsky.app',
        },
      },
      null,
      2
    ) + '\n'
  );
  return loadOwnedAcceptanceIdentities(journalPath);
}
export async function cleanupAcceptanceIdentities(options: {
  journalPath?: string;
  envPath?: string;
  verificationCleaned: boolean;
  acceptanceConfigurationCleared: boolean;
}) {
  assert(
    options.verificationCleaned && options.acceptanceConfigurationCleared,
    'Finish the owned record/grant checks and clear acceptance deployment credentials before identity teardown.'
  );
  const path = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  const journal = JSON.parse(await readFile(path, 'utf8')) as Journal;
  validate(journal, path);
  if (journal.cleaned) return;
  try {
    assert(
      (await readFile(resolve(journal.data, '.acceptance-owner'), 'utf8')) ===
        journal.marker
    );
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== 'ENOENT' ||
      !journal.cleanupDataAuthorized
    )
      throw error;
    try {
      await stat(journal.data);
      throw new Error(
        'Refuse an existing data directory with no ownership marker.',
        { cause: error }
      );
    } catch (dataError) {
      if ((dataError as NodeJS.ErrnoException).code !== 'ENOENT')
        throw dataError;
    }
    assert(
      (!journal.publisher.did || journal.publisher.deactivated) &&
        (!journal.visitor.did || journal.visitor.deactivated) &&
        journal.workers.every((worker) => worker.removed) &&
        journal.containerRemoved &&
        journal.tunnelStopped
    );
  }
  for (const account of [journal.publisher, journal.visitor]) {
    if (!account.did || account.deactivated) continue;
    if (account.deactivationRequested) {
      const status = await request(
        journal.origin,
        `com.atproto.sync.getRepoStatus?did=${account.did}`
      );
      if ((status as unknown as { active: boolean }).active === false) {
        account.deactivated = true;
        await save(path, journal);
        continue;
      }
    }
    await verifyIdentity(journal, account);
    const auth = await session(journal, account);
    const repo = await request(
      journal.origin,
      `com.atproto.repo.describeRepo?repo=${account.did}`
    );
    for (const collection of repo.collections) {
      let cursor: string | undefined;
      do {
        const records = await request(
          journal.origin,
          `com.atproto.repo.listRecords?repo=${account.did}&collection=${encodeURIComponent(collection)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
        );
        for (const record of records.records) {
          const key = record.uri.split('/').at(-1)!;
          const owned =
            collection === 'app.bsky.actor.profile' && key === 'self'
              ? account.profile
              : collection === 'app.bsky.feed.post' &&
                  key === account.probe?.rkey
                ? account.probe
                : undefined;
          assert(
            owned &&
              !owned.removed &&
              isDeepStrictEqual(owned.value, record.value) &&
              (!owned.cid || owned.cid === record.cid),
            'Refuse identity teardown while an unowned or remaining verification record exists.'
          );
          await request(
            journal.origin,
            'com.atproto.repo.deleteRecord',
            {
              repo: account.did,
              collection,
              rkey: key,
              swapRecord: record.cid,
            },
            `Bearer ${auth.accessJwt}`
          );
          assert(!(await readRecord(journal, account, collection, key)));
          owned.removed = true;
          await save(path, journal);
        }
        cursor = records.cursor;
      } while (cursor);
    }
    account.deactivationRequested = true;
    await save(path, journal);
    await request(
      journal.origin,
      'com.atproto.server.deactivateAccount',
      {},
      `Bearer ${auth.accessJwt}`
    );
    const status = await request(
      journal.origin,
      `com.atproto.sync.getRepoStatus?did=${account.did}`
    );
    assert((status as unknown as { active: boolean }).active === false);
    account.deactivated = true;
    await save(path, journal);
  }
  for (const worker of journal.workers) {
    if (worker.removed) continue;
    const existing = await cloudflare(
      `workers/scripts/${worker.name}/content/v2`
    );
    if (existing.ok) {
      const source = await workerContent(existing);
      assert(
        worker.versions.includes(source),
        'Refuse to remove a changed Worker.'
      );
      const removed = await cloudflare(`workers/scripts/${worker.name}`, {
        method: 'DELETE',
      });
      assert(removed.ok, 'The owned Worker removal failed.');
    } else assert(existing.status === 404);
    assert(
      (await cloudflare(`workers/scripts/${worker.name}/content/v2`)).status ===
        404
    );
    worker.removed = true;
    await save(path, journal);
  }
  if (journal.tunnel && !journal.tunnelStopped) {
    const child = spawnSync(
      'ps',
      ['-p', String(journal.tunnel.pid), '-o', 'command='],
      { encoding: 'utf8' }
    );
    if (child.status === 0) {
      assert(
        child.stdout.includes(journal.tunnel.command),
        'Refuse a reused tunnel PID.'
      );
      process.kill(journal.tunnel.pid, 'SIGTERM');
      let stopped = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        const current = spawnSync(
          'ps',
          ['-p', String(journal.tunnel.pid), '-o', 'stat=,command='],
          { encoding: 'utf8' }
        );
        if (current.status !== 0 || current.stdout.trim().startsWith('Z')) {
          stopped = true;
          break;
        }
        assert(
          current.stdout.includes(journal.tunnel.command),
          'Refuse a reused tunnel PID.'
        );
        await pause(250);
      }
      assert(stopped, 'The owned tunnel has not terminated.');
    }
    journal.tunnelStopped = true;
    await save(path, journal);
  } else if (!journal.tunnel) {
    journal.tunnelStopped = true;
    await save(path, journal);
  }
  command('docker', ['info', '--format', '{{.ServerVersion}}']);
  const existing = spawnSync('docker', ['inspect', journal.container], {
    encoding: 'utf8',
  });
  if (existing.status === 0) {
    const container = JSON.parse(existing.stdout)[0];
    assertPdsContainer(journal, container, Boolean(journal.storage?.active));
    command('docker', ['rm', '-f', journal.container]);
  }
  if (journal.storage && !journal.storage.removed) {
    const storage = journal.storage;
    for (const [name, volume] of [
      [storage.rollbackContainer, false],
      [storage.volumeContainer, true],
    ] as const) {
      const retained = inspectedContainer(name);
      if (retained) {
        assertPdsContainer(journal, retained, volume);
        assert(!retained.State.Running);
        command('docker', ['rm', name]);
      }
    }
    for (const helper of storage.helpers) {
      const retained = inspectedContainer(helper.name);
      if (retained) {
        assertStorageHelper(journal, retained, helper);
        command('docker', ['rm', '-f', helper.name]);
      }
    }
    if (ownedVolume(journal)) {
      assertVolumeAttachments(journal);
      assert(
        !command('docker', [
          'ps',
          '-a',
          '--filter',
          `volume=${storage.volume}`,
          '--format',
          '{{.Names}}',
        ])
      );
      command('docker', ['volume', 'rm', storage.volume]);
    }
    storage.removed = true;
    await save(path, journal);
  }
  journal.containerRemoved = true;
  await save(path, journal);
  const envPath = resolve(
    options.envPath ?? resolve(ROOT, '.env.standard-test.local')
  );
  const text = await readFile(envPath, 'utf8');
  const env = parseEnv(text);
  const keys = [
    'NEXT_PUBLIC_ATPROTO_DID',
    'NEXT_PUBLIC_BLUESKY_HANDLE',
    'ATPROTO_APP_PASSWORD',
    'ATPROTO_PUBLICATION_RKEY',
    'ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL',
    'ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN',
  ];
  if (env.NEXT_PUBLIC_ATPROTO_DID === journal.publisher.did)
    await privateWrite(
      envPath,
      text
        .split('\n')
        .filter((line) => !keys.some((key) => line.startsWith(`${key}=`)))
        .join('\n')
    );
  journal.cleanupDataAuthorized = true;
  await save(path, journal);
  await rm(journal.data, { recursive: true, force: true });
  for (const name of ['pds.env', 'tunnel.log'])
    await rm(resolve(dirname(path), name), { force: true });
  journal.adminPassword = '';
  journal.jwtSecret = '';
  journal.rotationKey = '';
  for (const account of [journal.publisher, journal.visitor]) {
    account.password = '';
    delete account.appPassword;
    delete account.invite;
  }
  journal.cleaned = new Date().toISOString();
  await save(path, journal);
}
export async function runIdentityCommand() {
  const { values } = parseArgs({
    options: {
      env: { type: 'string' },
      journal: { type: 'string' },
      cleanup: { type: 'boolean', default: false },
      repair: { type: 'boolean', default: false },
      'migrate-storage': { type: 'boolean', default: false },
      'rollback-storage': { type: 'boolean', default: false },
      'verification-cleaned': { type: 'boolean', default: false },
      'configuration-cleared': { type: 'boolean', default: false },
    },
  });
  try {
    assert(
      [
        values.repair,
        values.cleanup,
        values['migrate-storage'],
        values['rollback-storage'],
      ].filter(Boolean).length <= 1,
      'Choose one infrastructure operation.'
    );
    if (values['migrate-storage'] || values['rollback-storage']) {
      const operation = values['migrate-storage']
        ? migrateAcceptanceStorage
        : rollbackAcceptanceStorage;
      console.log(
        JSON.stringify(
          await operation({
            journalPath: values.journal,
            verificationCleaned: values['verification-cleaned'],
          })
        )
      );
      process.exit(0);
    }
    if (values.repair) {
      const repaired = await repairAcceptanceInfrastructure({
        journalPath: values.journal,
      });
      console.log(JSON.stringify(repaired));
      process.exit(0);
    }
    if (values.cleanup) {
      await cleanupAcceptanceIdentities({
        journalPath: values.journal,
        envPath: values.env,
        verificationCleaned: values['verification-cleaned'],
        acceptanceConfigurationCleared: values['configuration-cleared'],
      });
      console.log(
        'Owned acceptance identities and infrastructure are removed. Public PLC history remains.'
      );
      process.exit(0);
    }
    const identities = await provisionAcceptanceIdentities({
      envPath: values.env,
      journalPath: values.journal,
    });
    console.log(
      `Owned accounts are ready: ${identities.publisher.handle} (${identities.publisher.did}) and ${identities.visitor.handle} (${identities.visitor.did}).`
    );
    console.log(`Private recovery journal: ${identities.journalPath}`);
  } catch (error) {
    await privateWrite(
      resolve(
        dirname(resolve(values.journal ?? DEFAULT_JOURNAL)),
        'failure.json'
      ),
      JSON.stringify(
        { timestamp: new Date().toISOString(), error: String(error) },
        null,
        2
      ) + '\n'
    );
    console.error(
      `Identity bootstrap failed. Preserve the private recovery journal at ${resolve(values.journal ?? DEFAULT_JOURNAL)}. Credentials and provider URLs are withheld.`
    );
    process.exitCode = 1;
  }
}

if (isMain(import.meta.url)) await runIdentityCommand();
