import assert from 'node:assert/strict';
import { chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { ACCOUNT, DOMAIN, IMAGE, OWNER } from './config.mts';
import type { Journal } from './types.mts';

export async function privateWrite(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.new`;
  await writeFile(temporary, value, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}
export async function save(path: string, journal: Journal) {
  await privateWrite(path, JSON.stringify(journal, null, 2) + '\n');
}
export function validate(journal: Journal, path: string) {
  assert(
    journal.version === 1 &&
      journal.account === ACCOUNT &&
      journal.domain === DOMAIN
  );
  assert(
    /^[a-f0-9]{10}$/.test(journal.run) && /^[a-f0-9]{64}$/.test(journal.marker)
  );
  assert(journal.origin === `https://willie-pds-${journal.run}.${DOMAIN}`);
  assert(
    journal.container === `dev-williecubed-website-pds-${journal.run}` &&
      journal.image === IMAGE
  );
  assert(journal.data === resolve(dirname(path), 'pds'));
  assert(
    Number.isInteger(journal.port) &&
      journal.port > 1024 &&
      journal.port < 65536
  );
  assert(journal.publisher.handle === `pub${journal.run}.${DOMAIN}`);
  assert(journal.visitor.handle === `vis${journal.run}.${DOMAIN}`);
  assert(journal.publisher.did !== OWNER && journal.visitor.did !== OWNER);
  const names = [
    `willie-pds-${journal.run}`,
    `pub${journal.run}`,
    `vis${journal.run}`,
  ];
  assert(
    journal.workers.every(
      (worker) =>
        names.includes(worker.name) &&
        worker.source.includes(journal.marker) &&
        Array.isArray(worker.versions) &&
        worker.versions.every((source) => source.includes(journal.marker))
    )
  );
  assert(
    new Set(journal.workers.map((worker) => worker.name)).size ===
      journal.workers.length
  );
  if (journal.tunnel && journal.tunnel.upstream)
    assert(
      /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(journal.tunnel.upstream)
    );
  if (journal.storage) {
    const prefix = `dev-williecubed-website-pds-${journal.run}`;
    assert(
      journal.storage.volume === `${prefix}-data` &&
        journal.storage.rollbackContainer === `${prefix}-bind-backup` &&
        journal.storage.volumeContainer === `${prefix}-volume-backup`
    );
    assert(
      journal.storage.helpers.every(
        (helper) =>
          new RegExp(`^${prefix}-storage-[a-f0-9]{8}$`).test(helper.name) &&
          (!helper.source || helper.source === journal.data)
      )
    );
  }
}
