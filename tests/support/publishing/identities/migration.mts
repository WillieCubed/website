import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { DEFAULT_JOURNAL } from './config.mts';
import { repairAcceptanceInfrastructure } from './infrastructure.mts';
import { save, validate } from './journal.mts';
import { command } from './process.mts';
import {
  assertPdsContainer,
  copyAndVerifyScript,
  inspectedContainer,
  ownedVolume,
  recordManifest,
  sourceManifest,
  volumeCommand,
} from './storage.mts';
import type { Journal } from './types.mts';

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
  await stopBindStorage();
  await copyStorageVolume();
  await retainBindStorage();
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
  async function stopBindStorage(): Promise<void> {
    if (storage.phase === 'planned') {
      const current = inspectedContainer(journal.container);
      assertPdsContainer(journal, current, false);
      if (current.State.Running)
        command('docker', ['stop', '--time', '20', journal.container]);
      const stopped = inspectedContainer(journal.container);
      assert(stopped && !stopped.State.Running);
      storage.manifest = await sourceManifest(journal.data);
      storage.phase = 'stopped';
      await save(path, journal);
    }
  }
  async function copyStorageVolume(): Promise<void> {
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
  }
  async function retainBindStorage(): Promise<void> {
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
  }
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
