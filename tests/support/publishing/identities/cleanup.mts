import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual, parseEnv } from 'node:util';

import { DEFAULT_JOURNAL, ROOT } from './config.mts';
import { privateWrite, save, validate } from './journal.mts';
import { readRecord, request, session, verifyIdentity } from './pds.mts';
import { command } from './process.mts';
import { pause } from './shared.mts';
import {
  assertPdsContainer,
  assertStorageHelper,
  assertVolumeAttachments,
  inspectedContainer,
  ownedVolume,
} from './storage.mts';
import type { Journal, OwnedAccount } from './types.mts';
import { cloudflare, workerContent } from './workers.mts';

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
  await verifyCleanupDataOwnership();
  await deactivateOwnedAccounts();
  await removeOwnedWorkers();
  await stopOwnedTunnel();
  await removeOwnedStorage();
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
  async function verifyCleanupDataOwnership(): Promise<void> {
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
      assertCleanupResourcesRemoved();
    }
  }
  function assertCleanupResourcesRemoved(): void {
    assert(
      (!journal.publisher.did || journal.publisher.deactivated) &&
        (!journal.visitor.did || journal.visitor.deactivated) &&
        journal.workers.every((worker) => worker.removed) &&
        journal.containerRemoved &&
        journal.tunnelStopped
    );
  }
  async function deactivateOwnedAccounts(): Promise<void> {
    for (const account of [journal.publisher, journal.visitor])
      await deactivateOwnedAccount(account);
  }
  async function deactivateOwnedAccount(account: OwnedAccount): Promise<void> {
    if (!account.did || account.deactivated) return;
    if (account.deactivationRequested) {
      const status = await request(
        journal.origin,
        `com.atproto.sync.getRepoStatus?did=${account.did}`
      );
      if ((status as unknown as { active: boolean }).active === false) {
        account.deactivated = true;
        await save(path, journal);
        return;
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
        for (const record of records.records)
          await removeOwnedAccountRecord(
            account,
            auth.accessJwt,
            collection,
            record
          );
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
  async function removeOwnedAccountRecord(
    account: OwnedAccount,
    accessJwt: string,
    collection: string,
    record: { uri: string; cid: string; value: Record<string, unknown> }
  ): Promise<void> {
    const key = record.uri.split('/').at(-1)!;
    const owned = ownedAccountRecord(account, collection, key);
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
      `Bearer ${accessJwt}`
    );
    assert(!(await readRecord(journal, account, collection, key)));
    owned.removed = true;
    await save(path, journal);
  }
  function ownedAccountRecord(
    account: OwnedAccount,
    collection: string,
    key: string
  ) {
    return collection === 'app.bsky.actor.profile' && key === 'self'
      ? account.profile
      : collection === 'app.bsky.feed.post' && key === account.probe?.rkey
        ? account.probe
        : undefined;
  }
  async function removeOwnedWorkers(): Promise<void> {
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
        (await cloudflare(`workers/scripts/${worker.name}/content/v2`))
          .status === 404
      );
      worker.removed = true;
      await save(path, journal);
    }
  }
  async function stopOwnedTunnel(): Promise<void> {
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
  }
  async function removeOwnedStorage(): Promise<void> {
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
  }
}
